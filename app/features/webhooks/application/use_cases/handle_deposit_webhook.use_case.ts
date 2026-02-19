import { inject } from '@adonisjs/core'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import { Exception } from '@adonisjs/core/exceptions'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { PaymentStatus } from '#features/transactions/domain/enums/payment_status'
import Payment from '#features/transactions/domain/models/payment'
import Wallet from '#features/wallet/domain/models/wallet'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import { WebhookResponseDto } from '#features/webhooks/application/dto/webhook_response.dto'
import LedgerService from '#features/ledger/application/services/ledger_service'
import DepositTransactionCompleted from '#features/webhooks/application/events/deposit/deposit_transaction_completed'
import DepositTransactionFailed, {
  DepositTransactionFailedPayload,
} from '#features/webhooks/application/events/deposit/deposit_transaction_failed'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'
import PaymentNotFoundException from '#features/transactions/infrastructure/exceptions/payment_not_found_exception'
import WalletNotFoundException from '#features/wallet/infrastructure/exceptions/wallet_not_found_exception'
import WalletService from '#features/wallet/application/services/wallet_service'
import WalletAdjustException from '#features/wallet/infrastructure/exceptions/wallet_adjust_exception'

@inject()
export default class HandleDepositWebhookUseCase {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {}

  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    this.validatePayload(payload)
    const { reference } = payload.data

    paymentLog.info(
      'DEPOSIT_WEBHOOK_RECEIVED',
      { webhook: { reference, status } },
      'Received deposit webhook'
    )

    const trx = await db.transaction()

    try {
      const { transaction, payment, wallet } = await this.loadRequiredEntities(reference, trx)

      if (this.isIdempotentRequest(transaction, payment, status)) {
        paymentLog.warn(
          'DEPOSIT_WEBHOOK_IDEMPOTENT',
          {
            webhook: { reference, incomingStatus: status },
            transaction: { status: transaction.status },
            payment: { status: payment.status },
          },
          'Idempotent webhook call — skipping processing'
        )
        await trx.rollback()
        return this.createSuccessResponse()
      }

      const operatorResponse = { operator_response: payload as any }

      if (status === TransactionStatus.SUCCESS) {
        await this.processSuccessfulDeposit(transaction, payment, wallet, operatorResponse, trx)
      } else if (status === TransactionStatus.FAILED) {
        await this.processFailedDeposit(transaction, payment, operatorResponse, trx)
      } else {
        paymentLog.warn(
          'DEPOSIT_WEBHOOK_UNKNOWN_STATUS',
          { webhook: { reference, status } },
          'Webhook received with unhandled status'
        )
        await trx.rollback()
        return this.createSuccessResponse()
      }

      await trx.commit()

      paymentLog.info(
        'DEPOSIT_WEBHOOK_PROCESSED',
        { webhook: { reference, status } },
        'Deposit webhook processed successfully'
      )
      return this.createSuccessResponse()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  private validatePayload(payload: WebhookRequestDto): void {
    if (!payload.data.reference) {
      paymentLog.warn(
        'WEBHOOK_REFERENCE_REQUIRED',
        { webhook: payload.data },
        'Missing reference in deposit webhook'
      )
      throw new Exception('Reference manquante dans le webhook', {
        status: 422,
        code: 'WEBHOOK_REFERENCE_REQUIRED',
      })
    }

    if (!payload.data.status) {
      paymentLog.warn(
        'WEBHOOK_STATUS_REQUIRED',
        { webhook: payload.data },
        'Missing status in deposit webhook'
      )
      throw new Exception('Status manquant dans le webhook', {
        status: 422,
        code: 'WEBHOOK_STATUS_REQUIRED',
      })
    }
  }

  private async loadRequiredEntities(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{ transaction: Transaction; payment: Payment; wallet: Wallet }> {
    const transaction = await Transaction.query({ client: trx })
      .where('reference', reference)
      .forUpdate()
      .first()

    if (!transaction) {
      throw new TransactionNotFoundException('Transaction introuvable')
    }

    try {
      const [payments, wallet] = await Promise.all([
        this.paymentService.findByTransaction(transaction.transactionsUid || transaction.id),
        this.walletService.getByUserId(transaction.usersUid),
      ])

      if (payments.length === 0) {
        throw new PaymentNotFoundException('Paiement introuvable pour cette transaction')
      }

      return { transaction, payment: payments[0], wallet }
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
      }
      throw error
    }
  }

  private isIdempotentRequest(
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

  private async processSuccessfulDeposit(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    // 1. Mark payment success
    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)

    // 2. Credit wallet
    const creditAmount = Number(transaction.totalAmount || 0)
    const updatedWallet = await this.walletService.creditBalance(wallet.id, creditAmount, trx)

    if (
      !updatedWallet?.id ||
      updatedWallet.balance === null ||
      updatedWallet.balance === undefined
    ) {
      errorLog.error(
        'DEPOSIT_WALLET_CREDIT_FAILED',
        {
          wallet: { id: wallet.id, creditAmount, currentBalance: wallet.balance },
          transaction_id: transaction.id,
        },
        'CRITICAL: Failed to credit wallet during deposit'
      )
      throw new WalletAdjustException()
    }

    // 3. Mark transaction success with new balance
    await this.safeMarkTransactionSuccess(transaction.id, updatedWallet.balance!, trx)

    // 4. Record in ledger
    await this.ledgerService.recordDeposit(
      transaction,
      wallet.id,
      wallet.balance,
      updatedWallet.balance,
      trx
    )

    // 5. Fire-and-forget event dispatch
    DepositTransactionCompleted.dispatch({
      reference: transaction.reference,
      amount: transaction.amount,
      userId: transaction.usersUid,
      balanceAfter: updatedWallet.balance || 0,
    }).catch((err) => {
      errorLog.error(
        'DEPOSIT_EVENT_DISPATCH_FAILED',
        {
          reference: transaction.reference,
          error: err instanceof Error ? err.message : 'Unknown',
        },
        'Non-critical: Failed to dispatch deposit completed event'
      )
    })
  }

  private async processFailedDeposit(
    transaction: Transaction,
    payment: Payment,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    paymentLog.info(
      'DEPOSIT_FAILURE_PROCESSING',
      { transaction_id: transaction.id, payment_id: payment.id },
      'Processing failed deposit'
    )

    await this.safeMarkTransactionFailed(transaction.id, trx)
    await this.safeMarkPaymentFailed(payment.id, operatorResponse, trx)

    // Fire-and-forget
    DepositTransactionFailed.dispatch(<DepositTransactionFailedPayload>{
      reference: transaction.reference,
      amount: transaction.amount,
      userId: transaction.usersUid,
    }).catch((err) => {
      errorLog.error(
        'DEPOSIT_FAILED_EVENT_DISPATCH_FAILED',
        {
          reference: transaction.reference,
          error: err instanceof Error ? err.message : 'Unknown',
        },
        'Non-critical: Failed to dispatch deposit failed event'
      )
    })
  }

  // ── Safe status mark helpers ──────────────────────────

  private async safeMarkPaymentSuccess(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.paymentService.markSuccess(paymentId, operatorResponse, trx)
    } catch (error: any) {
      if (error?.code !== 'PAYMENT_ALREADY_SUCCESSFUL') throw error
      paymentLog.info(
        'DEPOSIT_PAYMENT_ALREADY_SUCCESS',
        { payment: { id: paymentId } },
        'Payment already successful, skipping'
      )
    }
  }

  private async safeMarkTransactionSuccess(
    transactionId: number,
    balance: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markSuccess(transactionId, balance, trx)
    } catch (error: any) {
      if (error?.code !== 'TRANSACTION_ALREADY_SUCCESSFUL') throw error
      transactionLog.info(
        'DEPOSIT_TRANSACTION_ALREADY_SUCCESS',
        { transaction: { id: transactionId } },
        'Transaction already successful, skipping'
      )
    }
  }

  private async safeMarkTransactionFailed(
    transactionId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markFailed(transactionId, trx)
    } catch (error: any) {
      if (error?.code !== 'TRANSACTION_ALREADY_FAILED') throw error
      transactionLog.info(
        'DEPOSIT_TRANSACTION_ALREADY_FAILED',
        { transaction: { id: transactionId } },
        'Transaction already failed, skipping'
      )
    }
  }

  private async safeMarkPaymentFailed(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.paymentService.markFailed(paymentId, operatorResponse, trx)
    } catch (error: any) {
      if (error?.code !== 'PAYMENT_ALREADY_FAILED') throw error
      paymentLog.info(
        'DEPOSIT_PAYMENT_ALREADY_FAILED',
        { payment: { id: paymentId } },
        'Payment already failed, skipping'
      )
    }
  }

  private createSuccessResponse(): WebhookResponseDto {
    return { status: 200, message: 'received' }
  }
}
