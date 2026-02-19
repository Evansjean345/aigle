import { inject } from '@adonisjs/core'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import WalletService from '#features/wallet/application/services/wallet_service'
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
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import WalletNotFoundException from '#features/wallet/infrastructure/exceptions/wallet_not_found_exception'
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'
import TransfertInterTransactionFailed from '#features/webhooks/application/events/transfert_inter/transfert_inter_transaction_failed'

const SUCCESS_RESPONSE: WebhookResponseDto = { status: 200, message: 'received' } as const

/**
 * Handles the second webhook for inter-transfer payments.
 * Manages state and processing logic for the second step of a
 * payment transfer operation (success or failure).
 */
@inject()
export default class HandleTransfertInterSecondWebhookUseCase {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {}

  /**
   * Executes the processing of a webhook for the second step of an inter-transfer.
   *
   * @param {WebhookRequestDto} payload - The payload containing the webhook data.
   * @param {TransactionStatus} status - The current status of the transaction.
   * @return {Promise<WebhookResponseDto>} A promise that resolves with the webhook response after processing.
   */
  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    paymentLog.info(
      'INTER_TRANSFER_SECOND_WEBHOOK_RECEIVED',
      { webhook: { status, reference: payload.data?.reference } },
      'Inter-transfer second webhook received'
    )

    const { reference, operatorResponse } = this.validateAndExtract(payload)

    const trx = await db.transaction()

    try {
      const { transaction, secondPayment, wallet } = await this.loadEntities(reference, trx)

      if (this.isIdempotent(transaction, secondPayment, status)) {
        await trx.commit()
        paymentLog.warn(
          'INTER_TRANSFER_SECOND_IDEMPOTENT',
          { webhook: { reference } },
          'Inter-transfer second step is idempotent, acknowledging'
        )
        return SUCCESS_RESPONSE
      }

      paymentLog.info(
        'INTER_TRANSFER_SECOND_PROCESSING',
        { webhook: { reference, status }, payment: { id: secondPayment.id } },
        'Processing inter-transfer second step'
      )

      await this.processSecondStep(
        transaction,
        secondPayment,
        wallet,
        operatorResponse,
        status,
        trx
      )
      await trx.commit()

      paymentLog.info(
        'INTER_TRANSFER_SECOND_SUCCESS',
        { webhook: { reference, status } },
        'Inter-transfer second step processed successfully'
      )
      return SUCCESS_RESPONSE
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Validates the payload of a webhook request and extracts relevant data.
   * Throws an exception if required fields are missing.
   *
   * @param {WebhookRequestDto} payload - The webhook request payload containing the data to validate and extract.
   * @return {{reference: string, operatorResponse: any}} An object containing the reference and operator response extracted from the payload.
   * @throws {Exception} If the payload is invalid due to a missing reference or status field.
   */
  private validateAndExtract(payload: WebhookRequestDto): {
    reference: string
    operatorResponse: any
  } {
    if (!payload?.data?.reference) {
      paymentLog.warn(
        'WEBHOOK_REFERENCE_REQUIRED',
        { webhook: payload?.data },
        'Missing reference in inter-transfer second webhook'
      )

      throw new Exception('Invalid payload: Missing reference', {
        status: 422,
        code: 'INVALID_WEBHOOK_PAYLOAD',
      })
    }

    if (!payload?.data?.status) {
      paymentLog.warn(
        'WEBHOOK_STATUS_REQUIRED',
        { webhook: payload?.data },
        'Missing status in inter-transfer second webhook'
      )
      throw new Exception('Invalid payload: Missing status', {
        status: 422,
        code: 'INVALID_WEBHOOK_PAYLOAD',
      })
    }

    return {
      reference: payload.data.reference,
      operatorResponse: payload.data,
    }
  }

  /**
   * Loads and fetches the required entities associated with a given transaction reference.
   * This method retrieves the transaction, associated payments, and wallet data, ensuring
   * all necessary entities are present and valid. Throws an error if any of the entities
   * are missing or invalid.
   *
   * @param {string} reference - The unique reference for the transaction to be fetched.
   * @param {TransactionClientContract} trx - The transactional database client to execute queries.
   * @return {Promise<{transaction: Transaction, secondPayment: Payment, wallet: Wallet}>}
   * The fetched entities, including the transaction, the second payment from a sequence of payments,
   * and the associated wallet.
   */
  private async loadEntities(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{
    transaction: Transaction
    secondPayment: Payment
    wallet: Wallet
  }> {
    const transaction = await Transaction.query({ client: trx })
      .where('reference', reference)
      .forUpdate()
      .first()

    if (!transaction) {
      throw new TransactionNotFoundException()
    }

    try {
      const [payments, wallet] = await Promise.all([
        this.paymentService.findByTransaction(transaction.transactionsUid),
        this.walletService.getByUserId(transaction.usersUid),
      ])

      const secondPayment = payments[1]

      if (!secondPayment) {
        throw new Exception('Invalid inter-transfer payments structure (missing second step)', {
          status: 400,
          code: 'INTER_TRANSFER_INVALID_PAYMENTS',
        })
      }

      paymentLog.debug(
        'INTER_TRANSFER_SECOND_ENTITIES_LOADED',
        {
          webhook: { reference },
          transaction: { id: transaction.id },
          payments: { count: payments.length },
          wallet: { id: wallet.id },
        },
        'Loaded entities for inter-transfer second step'
      )

      return { transaction, secondPayment, wallet }
    } catch (error) {
      if (error instanceof WalletNotFoundException) {
        //TODO: send error notification
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

  /**
   * Determines whether the operation is idempotent based on the status of the transaction and payment.
   *
   * @param {Transaction} transaction - The transaction object whose status will be evaluated.
   * @param {Payment} payment - The payment object whose status will be evaluated.
   * @param {TransactionStatus} incomingStatus - The incoming status to compare against the current statuses.
   * @return {boolean} Returns true if the operation is idempotent, otherwise false.
   */
  private isIdempotent(
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

  /**
   * Processes the second step of a transaction, handling success or failure cases, marking
   * payments and transactions accordingly, and performing ledger updates or dispatching events.
   *
   * @param {Transaction} transaction - The transaction to be processed.
   * @param {Payment} secondPayment - The second payment associated with the transaction.
   * @param {Wallet} wallet - The wallet involved in the transaction.
   * @param {any} operatorResponse - The response received from the operator.
   * @param {TransactionStatus} status - The status of the transaction (e.g., SUCCESS or FAILED).
   * @param {TransactionClientContract} trx - The database transaction client.
   * @return {Promise<void>} A promise that resolves when the processing is completed.
   */
  private async processSecondStep(
    transaction: Transaction,
    secondPayment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    status: TransactionStatus,
    trx: TransactionClientContract
  ): Promise<void> {
    const logCtx = {
      transaction: {
        reference: transaction.reference,
        id: transaction.id,
        payment: { id: secondPayment.id },
      },
    }

    if (status === TransactionStatus.SUCCESS) {
      transactionLog.debug(
        'INTER_TRANSFER_SECOND_MARKING_SUCCESS',
        logCtx,
        'Marking second payment and transaction as success'
      )

      await this.paymentService.markSuccess(secondPayment.id, { operatorResponse }, trx)
      await this.transactionService.markSuccess(transaction.id, wallet.balance, trx)

      await this.ledgerService.recordExternalTransfer(
        transaction,
        wallet.id,
        wallet.balance,
        wallet.balance,
        trx
      )
      return
    }

    if (status === TransactionStatus.FAILED) {
      transactionLog.debug(
        'INTER_TRANSFER_SECOND_MARKING_FAILED',
        logCtx,
        'Marking second payment and transaction as failed'
      )

      await this.paymentService.markFailed(secondPayment.id, { operatorResponse }, trx)
      await this.transactionService.markFailed(transaction.id, trx)

      const beneficiaryPhone = this.extractBeneficiaryPhone(secondPayment)

      // Fire-and-forget: dispatch doesn't need to block the webhook response
      TransfertInterTransactionFailed.dispatch({
        reference: transaction.reference,
        amount: transaction.amount,
        userId: transaction.usersUid,
        beneficiaryPhone,
      }).catch((err) => {
        errorLog.error(
          'INTER_TRANSFER_FAILED_EVENT_DISPATCH_ERROR',
          { reference: transaction.reference, error: err.message },
          'Failed to dispatch inter-transfer failure event'
        )
      })
      return
    }

    // Unexpected status — log warning instead of silently succeeding
    paymentLog.warn(
      'INTER_TRANSFER_SECOND_UNEXPECTED_STATUS',
      { webhook: { reference: transaction.reference, status } },
      `Unexpected status received: ${status}`
    )
  }

  /**
   * Extracts the phone number of the beneficiary from the payment details.
   *
   * @param {Payment} payment - The payment object containing beneficiary details.
   * @return {string} The extracted phone number if available; otherwise, returns 'unknown'.
   */
  private extractBeneficiaryPhone(payment: Payment): string {
    try {
      const raw = (payment as any)?.paymentDetails
      const details = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {})
      return details?.phone || 'unknown'
    } catch {
      return 'unknown'
    }
  }
}
