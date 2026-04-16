import { Exception } from '@adonisjs/core/exceptions'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import emitter from '@adonisjs/core/services/emitter'
import Transaction from '#features/transactions/domain/models/transaction'
import type Payment from '#features/transactions/domain/models/payment'
import type Wallet from '#features/wallet/domain/models/wallet'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import type { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import type { WebhookResponseDto } from '#features/webhooks/application/dto/webhook_response.dto'
import type PaymentService from '#features/transactions/application/services/payment_service'
import type TransactionService from '#features/transactions/application/services/transaction_service'
import type WalletService from '#features/wallet/application/services/wallet_service'
import ProviderErrorService from '#shared/infrastructure/services/provider_error_service'
import { AdminAction, ErrorSeverity, ErrorCategory } from '#shared/enums/provider_error_enums'
import { PROVIDER_SEVERITY_MAP } from '#shared/enums/provider_error_severity_map'
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'
import PaymentNotFoundException from '#features/transactions/infrastructure/exceptions/payment_not_found_exception'
import WalletNotFoundException from '#features/wallet/infrastructure/exceptions/wallet_not_found_exception'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import DispatchWebhookEventJob from '#features/webhooks/application/jobs/dispatch_webhook_event_job'
import type { WebhookEventName } from '#features/webhooks/application/jobs/dispatch_webhook_event_job'
import type { WebhookEventCode } from '#features/webhooks/type'

export const WEBHOOK_SUCCESS_RESPONSE: WebhookResponseDto = {
  status: 200,
  message: 'received',
} as const

export default abstract class BaseWebhookHandler {
  protected abstract readonly paymentService: PaymentService
  protected abstract readonly transactionService: TransactionService

  private static readonly TERMINAL_STATE_CODES = new Set([
    'PAYMENT_ALREADY_SUCCESSFUL',
    'PAYMENT_ALREADY_FAILED',
    'TRANSACTION_ALREADY_SUCCESSFUL',
    'TRANSACTION_ALREADY_FAILED',
    'INVALID_STATUS_TRANSITION',
  ])

  protected validatePayload(payload: WebhookRequestDto): void {
    if (!payload?.data?.reference) {
      paymentLog.warn(
        'WEBHOOK_REFERENCE_REQUIRED',
        { webhook: payload?.data },
        'Missing reference in webhook'
      )
      throw new Exception('Invalid payload: Missing reference', {
        status: 422,
        code: 'WEBHOOK_REFERENCE_REQUIRED',
      })
    }

    if (!payload?.data?.status) {
      paymentLog.warn(
        'WEBHOOK_STATUS_REQUIRED',
        { webhook: payload?.data },
        'Missing status in webhook'
      )
      throw new Exception('Invalid payload: Missing status', {
        status: 422,
        code: 'WEBHOOK_STATUS_REQUIRED',
      })
    }
  }

  protected async loadTransaction(
    reference: string,
    trx: TransactionClientContract
  ): Promise<Transaction> {
    const transaction = await Transaction.query({ client: trx })
      .where('reference', reference)
      .forUpdate()
      .first()

    if (!transaction) {
      throw new TransactionNotFoundException('Transaction introuvable')
    }

    return transaction
  }

  protected async loadTransactionWithPayments(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{ transaction: Transaction; payments: Payment[] }> {
    const transaction = await this.loadTransaction(reference, trx)
    const payments = await this.paymentService.findByTransaction(transaction.transactionsUid, trx)

    if (payments.length === 0) {
      throw new PaymentNotFoundException('Paiement introuvable pour cette transaction')
    }

    return { transaction, payments }
  }

  protected async loadTransactionWithPayment(
    reference: string,
    trx: TransactionClientContract,
    paymentOrder: 0 | 1 = 0
  ): Promise<{ transaction: Transaction; payment: Payment }> {
    const { transaction, payments } = await this.loadTransactionWithPayments(reference, trx)
    return { transaction, payment: payments[paymentOrder] }
  }

  /**
   * Loads the wallet associated with the given transaction.
   *
   * @param walletService
   * @param transaction
   * @param trx
   * @protected
   */
  protected async loadWallet(
    walletService: WalletService,
    transaction: Transaction,
    trx?: TransactionClientContract
  ): Promise<Wallet> {
    try {
      return await walletService.getByUserId(transaction.usersUid, trx)
    } catch (error) {
      if (error instanceof WalletNotFoundException) {
        errorLog.error(
          'WEBHOOK_WALLET_NOT_FOUND',
          {
            transaction_id: transaction.id,
            user_uid: transaction.usersUid,
            reference: transaction.reference,
          },
          'Critical: Wallet not found for user associated with transaction'
        )

        emitter
          .emit('alert:provider-error', {
            severity: ErrorSeverity.AMBIGUOUS,
            category: ErrorCategory.INTERNAL,
            adminAction: AdminAction.ESCALATE,
            adminMessage:
              'Wallet introuvable pour un utilisateur avec une transaction en cours. Intervention manuelle requise.',
            errorCode: 'WALLET_NOT_FOUND',
            transactionReference: transaction.reference,
            provider: 'internal',
            context: {
              transactionId: transaction.id,
              userUid: transaction.usersUid,
            },
          })
          .catch(() => {})
      }
      throw error
    }
  }

  protected isIdempotent(
    transaction: Transaction,
    payment: Payment,
    incomingStatus: TransactionStatus
  ): boolean {
    if (incomingStatus === TransactionStatus.SUCCESS) {
      return (
        transaction.status === TransactionStatus.SUCCESS && payment.status === PaymentStatus.SUCCESS
      )
    }

    return (
      transaction.status === TransactionStatus.FAILED && payment.status === PaymentStatus.FAILED
    )
  }

  protected async withTransaction<T>(
    handler: (trx: TransactionClientContract) => Promise<T>
  ): Promise<T> {
    const trx = await db.transaction()

    try {
      const result = await handler(trx)
      await trx.commit()
      return result
    } catch (error) {
      if (!trx.isCompleted) {
        await trx.rollback()
      }

      throw error
    }
  }

  protected async safeMarkPaymentSuccess(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.paymentService.markSuccess(paymentId, operatorResponse, trx)
    } catch (error: any) {
      if (BaseWebhookHandler.TERMINAL_STATE_CODES.has(error?.code)) {
        paymentLog.warn(
          'PAYMENT_MARK_SUCCESS_SKIPPED',
          { payment: { id: paymentId }, reason: error.code },
          'Payment already in terminal state, skipping'
        )
        return
      }
      throw error
    }
  }

  protected async safeMarkPaymentFailed(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract,
    error?: any
  ): Promise<void> {
    try {
      const errorCode = operatorResponse?.code || error?.code
      const definition = errorCode ? ProviderErrorService.resolve(errorCode) : undefined

      await this.paymentService.markFailed(paymentId, { definition, operatorResponse }, trx)

      if (definition && definition.adminAction !== AdminAction.NONE) {
        const severity = PROVIDER_SEVERITY_MAP[definition.code]
        emitter
          .emit('alert:provider-error', {
            severity,
            category: definition.category,
            adminAction: definition.adminAction,
            adminMessage: definition.adminMessage,
            errorCode: definition.code,
            transactionReference: operatorResponse?.reference || String(paymentId),
            provider: operatorResponse?.operator || 'unknown',
            context: {
              paymentId,
              operatorResponse,
              error,
            },
          })
          .catch(() => {})
      }
    } catch (err: any) {
      if (BaseWebhookHandler.TERMINAL_STATE_CODES.has(err?.code)) {
        paymentLog.warn(
          'PAYMENT_MARK_FAILED_SKIPPED',
          { payment: { id: paymentId }, reason: err.code },
          'Payment already in terminal state, skipping'
        )
        return
      }
      throw err
    }
  }

  protected async safeMarkTransactionSuccess(
    transactionId: number,
    balance: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markSuccess(transactionId, balance, trx)
    } catch (error: any) {
      if (BaseWebhookHandler.TERMINAL_STATE_CODES.has(error?.code)) {
        transactionLog.warn(
          'TRANSACTION_MARK_SUCCESS_SKIPPED',
          { transaction: { id: transactionId }, reason: error.code },
          'Transaction already in terminal state, skipping'
        )
        return
      }
      throw error
    }
  }

  protected async safeMarkTransactionFailed(
    transactionId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markFailed(transactionId, trx)
    } catch (error: any) {
      if (BaseWebhookHandler.TERMINAL_STATE_CODES.has(error?.code)) {
        transactionLog.warn(
          'TRANSACTION_MARK_FAILED_SKIPPED',
          { transaction: { id: transactionId }, reason: error.code },
          'Transaction already in terminal state, skipping'
        )
        return
      }
      throw error
    }
  }

  protected async dispatchEvent(
    _event: { dispatch: (payload: any) => Promise<any> },
    payload: any,
    eventCode: WebhookEventCode,
    reference: string
  ): Promise<void> {
    const eventNameMap: Record<WebhookEventCode, WebhookEventName> = {
      DEPOSIT_COMPLETED: 'DepositTransactionCompleted',
      DEPOSIT_FAILED: 'DepositTransactionFailed',
      TRANSFER_COMPLETED: 'TransfertTransactionCompleted',
      TRANSFER_FAILED: 'TransfertTransactionFailed',
      INTER_TRANSFER_FAILED: 'TransfertInterTransactionFailed',
      INTER_TRANSFER_INIT_FAILED: 'TransfertInterTransactionFailed',
    }

    const resolvedName = eventNameMap[eventCode]

    if (!resolvedName) {
      errorLog.error(
        `${eventCode}_UNKNOWN_EVENT`,
        { reference, eventCode },
        `Cannot map eventCode to job event name: ${eventCode}`
      )
      return
    }

    try {
      await DispatchWebhookEventJob.dispatch({
        eventName: resolvedName,
        eventData: payload,
        reference,
      })
    } catch (err: unknown) {
      errorLog.error(
        `${eventCode}_DISPATCH_ERROR`,
        {
          reference,
          error: err instanceof Error ? err.message : String(err),
        },
        `Synchronous error dispatching ${eventCode} event job`
      )
    }
  }

  protected buildOperatorResponse(payload: WebhookRequestDto): {
    operatorResponse: any
    error: any
  } {
    return {
      operatorResponse: payload.data,
      error: payload.error || payload.data?.error || null,
    }
  }
}
