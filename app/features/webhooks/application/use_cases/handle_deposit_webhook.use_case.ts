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

/**
 * Handles the business logic for processing deposit webhook events. This class is responsible for managing
 * transaction updates, payment state, and wallet adjustments based on incoming webhook payloads.
 */
@inject()
export default class HandleDepositWebhookUseCase {
  /**
   * Constructor for initializing dependencies required for transaction management and payment processing.
   *
   * @param {PaymentService} paymentService - The service responsible for handling payment operations.
   * @param {TransactionService} transactionService - The service for managing transaction-related business logic.
   * @param {WalletService} walletService - The service responsible for managing wallet operations.
   * @param {LedgerService} ledgerService - The service responsible for managing ledger operations.
   */
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {}

  /**
   * Executes the deposit webhook process based on the provided payload and status.
   *
   * @param {WebhookRequestDto} payload - The payload containing deposit webhook data to be processed.
   * @param {'success' | 'failed'} status - The status of the webhook, determining how to process the request.
   * @return {Promise<WebhookResponseDto>} A promise that resolves to the result of the webhook execution.
   */
  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    this.validatePayload(payload)
    const { reference: webTransactionRef } = payload.data

    paymentLog.info(
      'DEPOSIT_WEBHOOK_RECEIVED',
      { webhook: { reference: webTransactionRef, status } },
      'Received deposit webhook'
    )

    const trx = await db.transaction()

    try {
      const { transaction, payment, wallet } = await this.loadRequiredEntities(
        webTransactionRef,
        trx
      )

      paymentLog.debug(
        'DEPOSIT_WEBHOOK_ENTITIES_LOADED',
        {
          webhook: { reference: webTransactionRef },
          transaction: { id: transaction.id, status: transaction.status },
          payment: { id: payment.id, status: payment.status },
          wallet: { id: wallet.id },
        },
        'Loaded entities for deposit webhook'
      )

      if (this.isIdempotentRequest(transaction, payment, status)) {
        paymentLog.warn(
          'DEPOSIT_WEBHOOK_IDEMPOTENT',
          {
            webhook: { reference: payload.data.reference, incomingStatus: status },
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
      paymentLog.info(
        'DEPOSIT_WEBHOOK_PROCESSED',
        { webhook: { reference: payload.data.reference, status } },
        'Deposit webhook processed successfully'
      )
      return this.createSuccessResponse()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Validates the payload of the deposit webhook to ensure it contains the required reference.
   *
   * @param {WebhookRequestDto} payload - The payload object of the deposit webhook that needs to be validated.
   * @return {void} Throws an exception if the payload lacks the required reference.
   */
  private validatePayload(payload: WebhookRequestDto): void {
    if (!payload.data.reference) {
      paymentLog.warn(
        'WEBHOOK_REFERENCE_REQUIRED',
        {
          webhook: payload.data,
        },
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
        {
          webhook: payload.data,
        },
        'Missing status in deposit webhook'
      )

      throw new Exception('Status manquant dans le webhook', {
        status: 422,
        code: 'WEBHOOK_STATUS_REQUIRED',
      })
    }
  }

  /**
   * Loads required entities including transaction, payment, and wallet based on the provided reference.
   *
   * @param {string} reference - The unique reference identifier to find the transaction.
   * @param {TransactionClientContract} trx - The transaction client contract.
   * @return {Promise<{transaction: Object, payment: Object, wallet: Object}>} A promise that resolves to an object containing the transaction, payment, and wallet entities.
   * @throws {Exception} Throws an exception if the transaction, payment, or wallet is not found.
   */
  private async loadRequiredEntities(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{ transaction: Transaction; payment: Payment; wallet: Wallet }> {
    const transaction = await Transaction.query({
      client: trx,
    })
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

      const payment = payments[0]

      return { transaction, payment, wallet }
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

  /**
   * Determines whether a given request is idempotent based on the transaction, payment, and incoming status.
   *
   * @param {Transaction} transaction - The current transaction whose status is evaluated.
   * @param {Payment} payment - The associated payment for the transaction.
   * @param {TransactionStatus} incomingStatus - The incoming status of the transaction, typically from an external source.
   * @return {boolean} Returns true if the request is idempotent, false otherwise.
   */
  private isIdempotentRequest(
    transaction: Transaction,
    payment: Payment,
    incomingStatus: TransactionStatus
  ): boolean {
    const isIncomingSuccess = incomingStatus === TransactionStatus.SUCCESS

    if (isIncomingSuccess) {
      return (
        transaction.status === TransactionStatus.SUCCESS && payment.status === PaymentStatus.SUCCESS
      )
    } else {
      return (
        transaction.status === TransactionStatus.FAILED && payment.status === PaymentStatus.FAILED
      )
    }
  }

  /**
   * Processes a webhook for handling deposit transactions based on the provided status.
   *
   * @param {Transaction} transaction - The transaction associated with the webhook.
   * @param {Payment} payment - The payment details for the transaction.
   * @param {Wallet} wallet - The wallet related to the transaction.
   * @param {WebhookRequestDto} payload - The payload received from the webhook.
   * @param {string} status - The status of the webhook (e.g., 'success' or 'failed').
   * @param {TransactionClientContract} trx - The database transaction client to ensure atomic operations.
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
      'DEPOSIT_WEBHOOK_BODY_PROCESSING',
      {
        webhook: { reference: payload.data.reference, status },
        transaction: { id: transaction.id },
        payment: { id: payment.id },
        wallet: { id: wallet.id },
      },
      'Processing webhook body'
    )

    if (status === TransactionStatus.SUCCESS) {
      transactionLog.info(
        'DEPOSIT_SUCCESS_PROCESSING',
        { webhook: { reference: payload.data.reference } },
        'Processing successful deposit'
      )
      await this.processSuccessfulDeposit(transaction, payment, wallet, operatorResponse, trx)
    }

    if (status === TransactionStatus.FAILED) {
      transactionLog.info(
        'DEPOSIT_FAILED_PROCESSING',
        { webhook: { reference: payload.data.reference } },
        'Processing failed deposit'
      )
      await this.processFailedDeposit(transaction, payment, operatorResponse, trx)
    }
  }

  /**
   * Processes a successful deposit by updating the payment status,
   * adjusting the wallet balance, and marking the transaction as a success.
   *
   * @param {any} transaction - The transaction details related to the deposit.
   * @param {any} payment - The payment information associated with the deposit.
   * @param {any} wallet - The wallet object that needs updating after the deposit.
   * @param {any} operatorResponse - The response from the operator confirming the payment.
   * @param {TransactionClientContract} trx - The database transaction instance to handle atomic operations.
   * @return {Promise<void>} A Promise that resolves when the deposit processing is completed successfully.
   */
  private async processSuccessfulDeposit(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    transactionLog.debug(
      'DEPOSIT_PAYMENT_MARKING_SUCCESS',
      { payment: { id: payment.id } },
      'Marking payment as success'
    )
    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)

    transactionLog.debug(
      'DEPOSIT_WALLET_ADJUSTING',
      { wallet: { id: wallet.id } },
      'Adjusting wallet balance for successful deposit'
    )
    const updatedWallet = await this.walletService.creditBalance(
      wallet.id,
      Number(transaction.totalAmount || 0),
      trx
    )

    if (!updatedWallet || !updatedWallet.balance || !updatedWallet.id) {
      transactionLog.error(
        'DEPOSIT_WALLET_UPDATE_FAILED',
        { wallet: { id: wallet.id } },
        'Failed to update wallet during successful deposit'
      )

      // TODO: send critical email to admin in order to investigate //
      errorLog.error(
        'WALLET_REFUND_FAILED',
        {
          wallet: { id: wallet.id, amount: transaction.amount, balance: wallet.balance },
          transaction_id: transaction.id,
        },
        'CRITICAL: Wallet refund failed during failure processing'
      )

      throw new WalletAdjustException()
    }

    transactionLog.debug(
      'DEPOSIT_TRANSACTION_MARKING_SUCCESS',
      { transaction: { id: transaction.id } },
      'Marking transaction as success'
    )
    // Séquentiel: marquer la transaction après le wallet et le paiement
    await this.safeMarkTransactionSuccess(transaction.id, updatedWallet.balance!, trx)

    await this.ledgerService.recordDeposit(
      transaction,
      wallet.id,
      wallet.balance,
      updatedWallet.balance,
      trx
    )

    await DepositTransactionCompleted.dispatch({
      reference: transaction.reference,
      amount: transaction.amount,
      userId: transaction.usersUid,
      balanceAfter: updatedWallet.balance || 0,
    })
  }

  /**
   * Handles the processing of a failed deposit by marking the associated transaction and payment as failed.
   * This function performs both operations in parallel as they are independent of each other.
   *
   * @param {any} transaction - The transaction object related to the failed deposit.
   * @param {any} payment - The payment object associated with the failed transaction.
   * @param {any} operatorResponse - The response or error details from the payment operator.
   * @param {TransactionClientContract} trx - The transaction client contract used for database operations.
   * @return {Promise<void>} - A promise that resolves when the failed deposit process is completed.
   */
  private async processFailedDeposit(
    transaction: Transaction,
    payment: Payment,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    transactionLog.debug(
      'DEPOSIT_MARKING_FAILED',
      { transaction: { id: transaction.id }, payment: { id: payment.id } },
      'Marking payment and transaction as failed'
    )

    // Séquentiel: marquer la transaction puis le paiement
    await this.safeMarkTransactionFailed(transaction.id, trx)
    await this.safeMarkPaymentFailed(payment.id, operatorResponse, trx)

    await DepositTransactionFailed.dispatch(<DepositTransactionFailedPayload>{
      reference: transaction.reference,
      amount: transaction.amount,
      userId: transaction.usersUid,
    })
  }

  /**
   * Safely marks a payment as successful by interacting with the payment service.
   * If the payment is already marked as successful, it logs the information and skips further action.
   * Throws an error for any other issues encountered during the process.
   *
   * @param {number} paymentId - The unique identifier of the payment to be marked as successful.
   * @param {any} operatorResponse - The response data originating from the payment operator.
   * @param {TransactionClientContract} trx - The transaction client instance for executing database operations atomically.
   * @return {Promise<void>} A promise that resolves when the payment is successfully marked as such or skips if already marked.
   */
  private async safeMarkPaymentSuccess(
    paymentId: number,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.paymentService.markSuccess(paymentId, operatorResponse, trx)
      paymentLog.info(
        'PAYMENT_MARKED_AS_SUCCESS',
        { payment_id: paymentId },
        'Payment marked as success'
      )
    } catch (error: any) {
      if (error?.code !== 'PAYMENT_ALREADY_SUCCESSFUL') {
        errorLog.error(
          'PAYMENT_MARK_SUCCESS_ERROR',
          { payment_id: paymentId, error: error.message },
          'Failed to mark payment as success'
        )
        throw error
      }
      paymentLog.info(
        'DEPOSIT_PAYMENT_ALREADY_SUCCESS',
        { payment: { id: paymentId } },
        'Payment already successful, skipping'
      )
    }
  }

  /**
   * Marks the specified transaction as successful while handling any errors that might occur.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as successful.
   * @param {number} balance - The balance associated with the transaction.
   * @param {TransactionClientContract} trx - The transaction client instance used for the operation.
   * @return {Promise<void>} A promise that resolves when the operation is complete.
   */
  private async safeMarkTransactionSuccess(
    transactionId: number,
    balance: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markSuccess(transactionId, balance, trx)
      paymentLog.info(
        'TRANSACTION_MARKED_SUCCESS',
        { transaction: { id: transactionId }, wallet: { balanceAfter: balance } },
        'Transaction marked as success'
      )
    } catch (error: any) {
      if (error?.code !== 'TRANSACTION_ALREADY_SUCCESSFUL') {
        errorLog.error(
          'TRANSACTION_MARK_SUCCESS_ERROR',
          { transaction_id: transactionId, error: error.message },
          'Failed to mark transaction as success'
        )
        throw error
      }
      paymentLog.info(
        'DEPOSIT_TRANSACTION_ALREADY_SUCCESS',
        { transaction: { id: transactionId } },
        'Transaction already successful, skipping'
      )
    }
  }

  /**
   * Marks a transaction as failed in a safe manner by handling specific errors related to the transaction already being marked as failed.
   *
   * @param {any} transactionId - The unique identifier of the transaction to be marked as failed.
   * @param {TransactionClientContract} trx - The database transaction client used for performing the operation.
   * @return {Promise<void>} A promise that resolves when the transaction has been safely marked as failed.
   */
  private async safeMarkTransactionFailed(
    transactionId: number,
    trx: TransactionClientContract
  ): Promise<void> {
    try {
      await this.transactionService.markFailed(transactionId, trx)
      paymentLog.info(
        'TRANSACTION_MARKED_FAILED',
        { transaction: { id: transactionId } },
        'Transaction marked as failed'
      )
    } catch (error: any) {
      if (error?.code !== 'TRANSACTION_ALREADY_FAILED') {
        errorLog.error(
          'TRANSACTION_MARK_FAILED_ERROR',
          { transaction_id: transactionId, error: error.message },
          'Failed to mark transaction as failed'
        )
        throw error
      }
      paymentLog.info(
        'DEPOSIT_TRANSACTION_ALREADY_FAILED',
        { transaction: { id: transactionId } },
        'Transaction already failed, skipping'
      )
    }
  }

  /**
   * Safely marks a payment as failed by invoking the payment service, with error handling to avoid processing already-failed payments.
   *
   * @param {any} paymentId - The unique identifier of the payment to be marked as failed.
   * @param {any} operatorResponse - The response or data from the payment operator detailing the failure reason.
   * @param {TransactionClientContract} trx - The database transaction object used to ensure atomicity during the operation.
   * @return {Promise<void>} A promise that resolves when the operation is completed successfully or skips processing if already failed.
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
      paymentLog.info(
        'DEPOSIT_PAYMENT_ALREADY_FAILED',
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
