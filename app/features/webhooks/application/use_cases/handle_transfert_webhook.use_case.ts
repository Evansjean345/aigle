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
import WalletService from '#features/wallet/application/services/wallet_service'
import TransfertTransactionCompleted, {
  TransfertTransactionCompletedPayload,
} from '#features/webhooks/application/events/transfert/transfert_transaction_completed'
import transactionLog from '#shared/infrastructure/logging/transaction_log'

/**
 * Class responsible for handling and processing transfer-related webhook events.
 * It validates incoming webhook payloads, ensures idempotency, and performs updates
 * on transactions, payments, and wallets accordingly.
 */
@inject()
export default class HandleTransfertWebhookUseCase {
  /**
   * Initializes a new instance of the class.
   *
   * @param {PaymentService} paymentService - The service used for handling payment operations.
   * @param {TransactionService} transactionService - The service used for managing transactions.
   * @param {WalletService} walletService - The service used for wallet-related operations.
   * @param ledgerService
   */
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {}

  /**
   * Processes a webhook request for a transfer event, validates payloads, ensures idempotency,
   * and performs necessary updates to transactions, payments, and wallets.
   *
   * @param {WebhookRequestDto} payload - The incoming webhook request data containing transaction reference and other details.
   * @param {'success' | 'failed'} status - The status of the transfer, either 'success' or 'failed'.
   * @return {Promise<WebhookResponseDto>} A promise that resolves with a WebhookResponseDto representing the response of the webhook processing.
   */
  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    this.validatePayload(payload)
    const { reference } = payload.data

    transactionLog.info(
      'TRANSFER_WEBHOOK_PROCESSING',
      { webhook: { reference, status } },
      'Processing transfer webhook'
    )

    const trx = await db.transaction()
    try {
      const { transaction, payment, wallet } = await this.loadRequiredEntities(reference)

      transactionLog.debug(
        'TRANSFER_ENTITIES_LOADED',
        {
          webhook: { reference },
          transaction: { id: transaction.id, status: transaction.status },
          payment: { id: payment.id, status: payment.status },
          wallet: { id: wallet.id },
        },
        'Loaded entities for transfer webhook'
      )

      if (this.isIdempotentRequest(transaction, payment, status)) {
        transactionLog.warn(
          'TRANSFER_WEBHOOK_IDEMPOTENT',
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

      await this.processWebhook(transaction, payment, wallet, payload, status, trx)
      await trx.commit()
      transactionLog.info(
        'TRANSFER_WEBHOOK_SUCCESS',
        { webhook: { reference, status } },
        'Transfer webhook processed successfully'
      )
      return this.createSuccessResponse()
    } catch (error) {
      await trx.rollback()
      transactionLog.error(
        'TRANSFER_WEBHOOK_ERROR',
        {
          webhook: { reference },
          error: {
            status: (error as any).status || 500,
            message: (error as any).message || 'Transfer webhook processing error',
            data: (error as any).data || {},
          },
        },
        (error as any).message || 'Transfer webhook processing error'
      )
      throw error
    }
  }

  /**
   * Validates the provided webhook request payload to ensure all required properties are present.
   *
   * @param {WebhookRequestDto} payload - The webhook request payload to be validated.
   * @return {void} This method does not return a value but throws an exception if validation fails.
   */
  private validatePayload(payload: WebhookRequestDto): void {
    if (!payload.data.reference) {
      throw new Exception('Reference manquante dans le webhook', {
        status: 422,
        code: 'WEBHOOK_REFERENCE_REQUIRED',
      })
    }
  }

  /**
   * Loads the required entities based on the provided reference.
   *
   * @param {string} reference - The reference used to identify the transaction and related entities.
   * @return {Promise<{transaction: Transaction, payment: Payment, wallet: Wallet}>} A promise that resolves with an object containing the transaction, payment, and wallet entities.
   * @throws {Exception} If no payment is found for the transaction, an exception is thrown with a status of 404 and code 'PAYMENT_NOT_FOUND'.
   */
  private async loadRequiredEntities(
    reference: string
  ): Promise<{ transaction: Transaction; payment: Payment; wallet: Wallet }> {
    const transaction = await this.transactionService.findByReference(reference)

    const [payments, wallet] = await Promise.all([
      this.paymentService.findByTransaction(transaction.transactionsUid || transaction.id),
      this.walletService.getByUserId(transaction.usersUid),
    ])

    if (payments.length === 0) {
      throw new Exception('Paiement introuvable pour cette transaction', {
        status: 404,
        code: 'PAYMENT_NOT_FOUND',
      })
    }

    const payment = payments[0]
    return { transaction, payment, wallet }
  }

  /**
   * Determines if a request is idempotent based on the current transaction, payment, and incoming transaction status.
   *
   * @param {Transaction} transaction - The current transaction object containing the status.
   * @param {Payment} payment - The payment object containing the status.
   * @param {TransactionStatus} incomingStatus - The status of the incoming transaction.
   * @return {boolean} Returns true if the request is idempotent, otherwise false.
   */
  private isIdempotentRequest(
    transaction: Transaction,
    payment: Payment,
    incomingStatus: TransactionStatus
  ): boolean {
    const isIncomingSuccess = incomingStatus === TransactionStatus.SUCCESS
    const isCurrentSuccess =
      transaction.status === TransactionStatus.SUCCESS || payment.status === PaymentStatus.SUCCESS
    const isCurrentFailed =
      transaction.status === TransactionStatus.FAILED || payment.status === PaymentStatus.FAILED

    return (isIncomingSuccess && isCurrentSuccess) || (!isIncomingSuccess && isCurrentFailed)
  }

  /**
   * Processes a webhook for a transaction, determining success or failure
   * and delegating to appropriate transfer handling methods.
   *
   * @param {Transaction} transaction - The transaction associated with the webhook.
   * @param {Payment} payment - The payment object related to the transaction.
   * @param {Wallet} wallet - The wallet involved in the transaction.
   * @param {WebhookRequestDto} payload - The data payload received from the webhook.
   * @param {string} status - The status of the transaction, indicating success or failure.
   * @param {TransactionClientContract} trx - The transaction client instance for database operations.
   * @return {Promise<void>} Resolves when the webhook processing is complete.
   */
  private async processWebhook(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    payload: WebhookRequestDto,
    status: TransactionStatus,
    trx: TransactionClientContract
  ): Promise<void> {
    const operatorResponse = { operator_response: payload as any }

    transactionLog.debug(
      'TRANSFER_WEBHOOK_BODY_PROCESSING',
      {
        webhook: { reference: payload.data.reference, status },
        transaction: { id: transaction.id },
        payment: { id: payment.id },
        wallet: { id: wallet.id },
      },
      'Processing transfer webhook body'
    )

    if (status === TransactionStatus.SUCCESS) {
      await this.processSuccessfulTransfer(transaction, payment, wallet, operatorResponse, trx)
    }

    if (status === TransactionStatus.FAILED) {
      await this.processFailedTransfer(transaction, payment, wallet, operatorResponse, trx)
    }
  }

  /**
   * Handles the processing of a successful transfer by marking the payment and transaction as successful.
   *
   * @param {Transaction} transaction - The transaction object related to the transfer.
   * @param {Payment} payment - The payment object associated with the transfer.
   * @param {Wallet} wallet - The wallet object containing the current balance.
   * @param {any} operatorResponse - The response from the operator regarding the transfer.
   * @param {TransactionClientContract} trx - The database transaction client for ensuring atomic operations.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  private async processSuccessfulTransfer(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)
    await this.safeMarkTransactionSuccess(transaction.id, Number(wallet.balance), trx)

    await this.ledgerService.recordTransfer(
      transaction,
      wallet.id,
      Number(wallet.balance) + Number(transaction.amount),
      wallet.balance,
      trx
    )

    await TransfertTransactionCompleted.dispatch(<TransfertTransactionCompletedPayload>{
      reference: transaction.reference,
      amount: transaction.amount,
      userId: transaction.usersUid,
      balanceAfter: wallet.balance || 0,
      beneficiaryPhone: payment.paymentDetails.phone || 'unknown',
    })
  }

  /**
   * Processes a failed transfer by marking the transaction and payment as failed
   * and refunding the wallet with the credited amount from the failed transaction.
   *
   * @param {Transaction} transaction - The transaction to be marked as failed.
   * @param {Payment} payment - The payment to be marked as failed.
   * @param {Wallet} wallet - The wallet to be refunded with the credited amount.
   * @param {any} operatorResponse - The response from the operator, detailing the failure.
   * @param {TransactionClientContract} trx - The database transaction client used for transactional operations.
   *
   * @return {Promise<void>} A Promise that resolves when the failed transfer has been processed.
   */
  private async processFailedTransfer(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    // mark both failed first
    await Promise.all([
      this.safeMarkTransactionFailed(transaction.id, trx),
      this.safeMarkPaymentFailed(payment.id, operatorResponse, trx),
    ])

    console.log('starting refunding')

    // refund wallet (credit back the debited total amount including fees)
    const refunded = await this.walletService.creditBalance(
      wallet.id,
      Number(transaction.amount || 0),
      trx
    )

    if (refunded) {
      await this.ledgerService.recordReversal(
        transaction,
        wallet.id,
        wallet.balance,
        refunded.balance,
        trx
      )
    }

    if (!refunded) {
      throw new Exception('Echec de remboursement du wallet', {
        status: 500,
        code: 'WALLET_REFUND_FAILED',
      })
    }
  }

  /**
   * Safely marks a payment as successful by invoking the payment service.
   * Logs and skips the operation if the payment is already marked as successful.
   *
   * @param {number} paymentId - The unique identifier of the payment to mark as successful.
   * @param {any} operatorResponse - The response object received from an external operator containing details about the payment.
   * @param {TransactionClientContract} trx - The transaction client used for handling database transactions.
   * @return {Promise<void>} A promise that resolves once the operation is complete.
   */
  private async safeMarkPaymentSuccess(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.paymentService.markSuccess(paymentId, operatorResponse, trx)
    } catch (error: any) {
      if (error?.code !== 'PAYMENT_ALREADY_SUCCESSFUL') throw error
      transactionLog.info(
        'TRANSFER_PAYMENT_ALREADY_SUCCESS',
        { payment: { id: paymentId } },
        'Payment already successful, skipping'
      )
    }
  }

  /**
   * Safely marks a transaction as successful while handling potential errors for already successful transactions.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as successful.
   * @param {number} balance - The balance associated with the transaction.
   * @param {TransactionClientContract} trx - The transaction client context for database operations.
   * @return {Promise<void>} Resolves when the operation completes successfully or skips if already successful.
   */
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
        'TRANSFER_TRANSACTION_ALREADY_SUCCESS',
        { transaction: { id: transactionId } },
        'Transaction already successful, skipping'
      )
    }
  }

  /**
   * Marks a transaction as failed in a safe manner, ensuring that specific errors are handled gracefully.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as failed.
   * @param {TransactionClientContract} trx - The transaction client used for database operations.
   * @return {Promise<void>} A promise that resolves when the operation is completed.
   */
  private async safeMarkTransactionFailed(
    transactionId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markFailed(transactionId, trx)
    } catch (error: any) {
      if (error?.code !== 'TRANSACTION_ALREADY_FAILED') throw error
      transactionLog.info(
        'TRANSFER_TRANSACTION_ALREADY_FAILED',
        { transaction: { id: transactionId } },
        'Transaction already failed, skipping'
      )
    }
  }

  /**
   * Attempts to mark a payment as failed safely by handling potential errors.
   * If the payment has already been marked as failed, the error is logged and skipped.
   *
   * @param {number} paymentId - The unique identifier of the payment to be marked as failed.
   * @param {any} operatorResponse - The response or metadata from the payment operator.
   * @param {TransactionClientContract} trx - The transaction client used to perform the database operation.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  private async safeMarkPaymentFailed(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.paymentService.markFailed(paymentId, operatorResponse, trx)
    } catch (error: any) {
      if (error?.code !== 'PAYMENT_ALREADY_FAILED') throw error
      transactionLog.info(
        'TRANSFER_PAYMENT_ALREADY_FAILED',
        { payment: { id: paymentId } },
        'Payment already failed, skipping'
      )
    }
  }

  /**
   * Creates a success response object indicating that the webhook request was received successfully.
   *
   * @return {WebhookResponseDto} An object containing the status code and a success message.
   */
  private createSuccessResponse(): WebhookResponseDto {
    return { status: 200, message: 'received' }
  }
}
