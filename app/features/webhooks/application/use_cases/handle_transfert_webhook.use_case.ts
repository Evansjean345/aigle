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
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import TransactionNotFoundException from '#features/transactions/infrastructure/exceptions/transaction_not_found_exception'
import PaymentNotFoundException from '#features/transactions/infrastructure/exceptions/payment_not_found_exception'
import WalletNotFoundException from '#features/wallet/infrastructure/exceptions/wallet_not_found_exception'
import WalletAdjustException from '#features/wallet/infrastructure/exceptions/wallet_adjust_exception'

@inject()
export default class HandleTransfertWebhookUseCase {
  /**
   * Constructs an instance of the class with the required service dependencies.
   *
   * @param {PaymentService} paymentService - A service responsible for handling payment operations.
   * @param {TransactionService} transactionService - A service responsible for managing transactions.
   * @param {WalletService} walletService - A service for handling wallet-related operations.
   * @param {LedgerService} ledgerService - A service to interact with the ledger for financial records.
   */
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {}

  /**
   * Handles the execution of a webhook request and processes the associated transaction based on the provided status.
   *
   * @param {WebhookRequestDto} payload - The incoming webhook request data, including transaction details.
   * @param {TransactionStatus} status - The status of the transaction (e.g., SUCCESS, FAILED).
   * @return {Promise<WebhookResponseDto>} A promise that resolves to a webhook response DTO representing the result of the operation.
   */
  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    this.validatePayload(payload)
    const { reference } = payload.data

    paymentLog.info(
      'TRANSFER_WEBHOOK_RECEIVED',
      { webhook: { reference, status } },
      'Received transfer webhook'
    )

    const trx = await db.transaction()

    try {
      const { transaction, payment, wallet } = await this.loadRequiredEntities(reference, trx)

      if (this.isIdempotentRequest(transaction, payment, status)) {
        paymentLog.warn(
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

      const operatorResponse = { operator_response: payload as any }

      if (status === TransactionStatus.SUCCESS) {
        await this.processSuccessfulTransfer(transaction, payment, wallet, operatorResponse, trx)
      } else if (status === TransactionStatus.FAILED) {
        await this.processFailedTransfer(transaction, payment, wallet, operatorResponse, trx)
      } else {
        paymentLog.warn(
          'TRANSFER_WEBHOOK_UNKNOWN_STATUS',
          { webhook: { reference, status } },
          'Webhook received with unhandled status'
        )
        await trx.rollback()
        return this.createSuccessResponse()
      }

      await trx.commit()

      paymentLog.info(
        'TRANSFER_WEBHOOK_PROCESSED',
        { webhook: { reference, status } },
        'Transfer webhook processed successfully'
      )
      return this.createSuccessResponse()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Validates the payload of a webhook request by checking the presence
   * of required fields such as `reference` and `status`. Throws an exception
   * if any required field is missing.
   *
   * @param {WebhookRequestDto} payload - The data transfer object containing webhook data to be validated.
   * @return {void} This method does not return anything. It throws an exception if validation fails.
   */
  private validatePayload(payload: WebhookRequestDto): void {
    if (!payload.data.reference) {
      paymentLog.warn(
        'WEBHOOK_REFERENCE_REQUIRED',
        { webhook: payload.data },
        'Missing reference in transfer webhook'
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
        'Missing status in transfer webhook'
      )
      throw new Exception('Status manquant dans le webhook', {
        status: 422,
        code: 'WEBHOOK_STATUS_REQUIRED',
      })
    }
  }

  /**
   * Loads and retrieves the required entities (transaction, payment, and wallet) for a given reference.
   *
   * @param {string} reference - The unique identifier of the transaction to be retrieved.
   * @param {TransactionClientContract} trx - The database transaction client to be used for the query.
   * @return {Promise<{transaction: Transaction, payment: Payment, wallet: Wallet}>} An object containing the transaction, payment, and wallet entities.
   * @throws {TransactionNotFoundException} If the transaction with the provided reference is not found.
   * @throws {PaymentNotFoundException} If no payments are associated with the identified transaction.
   * @throws {WalletNotFoundException} If the wallet for the user associated with the transaction is not found.
   */
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
        throw new PaymentNotFoundException('Aucun paiement trouvé pour cette transaction')
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

  /**
   * Determines if a request is idempotent based on the current transaction, payment, and incoming status.
   *
   * @param {Transaction} transaction - The transaction object to evaluate.
   * @param {Payment} payment - The associated payment object to evaluate.
   * @param {TransactionStatus} incomingStatus - The incoming status of the transaction.
   * @return {boolean} Returns true if the request is idempotent, otherwise false.
   */
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

  /**
   * Processes a successful transfer by marking transactions and payments as successful,
   * recording ledger entries, and dispatching a transfer completion event.
   *
   * @param {Transaction} transaction - The transaction object representing the transfer.
   * @param {Payment} payment - The payment object associated with the transaction.
   * @param {Wallet} wallet - The wallet object representing the user's wallet.
   * @param {any} operatorResponse - The response received from the payment operator.
   * @param {TransactionClientContract} trx - The transaction client used for database operations.
   * @return {Promise<void>} A promise that resolves when the process is completed.
   */
  private async processSuccessfulTransfer(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    const currentBalance = Number(wallet.balance)

    // persister les transactions et les paiements
    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)
    await this.safeMarkTransactionSuccess(transaction.id, currentBalance, trx)

    // persister ecritures comptables
    const balanceBefore = currentBalance + Number(transaction.amount)
    await this.ledgerService.recordTransfer(
      transaction,
      wallet.id,
      balanceBefore,
      currentBalance,
      trx
    )

    // Dispatcher l'événement lorsque la transaction été traitée avec succès
    TransfertTransactionCompleted.dispatch(<TransfertTransactionCompletedPayload>{
      reference: transaction.reference,
      amount: transaction.amount,
      userId: transaction.usersUid,
      balanceAfter: currentBalance,
      beneficiaryPhone: payment.paymentDetails?.phone || 'unknown',
    }).catch((err) => {
      errorLog.error(
        'TRANSFER_EVENT_DISPATCH_FAILED',
        {
          reference: transaction.reference,
          error: err instanceof Error ? err.message : 'Unknown',
        },
        'Non-critical: Failed to dispatch transfer completed event'
      )
    })
  }

  /**
   * Handles the processing of a failed transfer operation, ensuring the associated transaction and payment
   * are marked as failed, and the debited amount is refunded to the wallet. It also records the reversal transaction.
   *
   * @param {Transaction} transaction - The transaction object associated with the failed transfer.
   * @param {Payment} payment - The payment object linked to the failed transaction.
   * @param {Wallet} wallet - The wallet object to which the refund will be credited.
   * @param {any} operatorResponse - The operator's response or error information related to the failure.
   * @param {TransactionClientContract} trx - The database transaction object for ensuring atomicity.
   * @return {Promise<void>} A promise resolving when the process is completed, or an error is thrown in case of failure.
   */
  private async processFailedTransfer(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    paymentLog.info(
      'TRANSFER_FAILURE_PROCESSING_START',
      {
        transaction_id: transaction.id,
        payment_id: payment.id,
        reference: transaction.reference,
      },
      'Starting to process failed transfer and refund'
    )

    // Mark failed: transaction first (source of truth), then payment
    await this.safeMarkTransactionFailed(transaction.id, trx)
    await this.safeMarkPaymentFailed(payment.id, operatorResponse, trx)

    // Refund the debited amount
    const refundAmount = Number(transaction.amount || 0)
    const refunded = await this.walletService.creditBalance(wallet.id, refundAmount, trx)

    if (!refunded) {
      errorLog.error(
        'WALLET_REFUND_FAILED',
        {
          wallet: { id: wallet.id, amount: refundAmount, balance: wallet.balance },
          transaction_id: transaction.id,
        },
        'CRITICAL: Wallet refund failed during failure processing'
      )
      throw new WalletAdjustException('Remboursement du portefeuille échoué')
    }

    await this.ledgerService.recordReversal(
      transaction,
      wallet.id,
      wallet.balance,
      refunded.balance,
      trx
    )

    transactionLog.info(
      'WALLET_REFUND_SUCCESS',
      {
        wallet_id: wallet.id,
        amount: refundAmount,
        new_balance: refunded.balance,
        transaction_id: transaction.id,
      },
      'Wallet refunded successfully after failed transfer'
    )
  }

  /**
   * Marks the payment as successful in a safe manner. Handles duplicate success marking gracefully.
   *
   * @param {number} paymentId - The unique identifier of the payment to be marked as successful.
   * @param {any} operatorResponse - The response data from the payment operator.
   * @param {TransactionClientContract} trx - The database transaction object to be used for the operation.
   * @return {Promise<void>} Resolves when the payment is marked as successful or if the payment is already marked as successful.
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
   * Marks a transaction as successful in a safe manner by handling potential errors.
   * If the transaction is already marked as successful, the method will log the event
   * and avoid re-executing the success marking process.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as successful.
   * @param {number} balance - The balance associated with the transaction.
   * @param {TransactionClientContract} trx - The transaction client contract to execute database operations.
   * @return {Promise<void>} Resolves when the operation completes successfully, or handles specific errors if applicable.
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
   * Safely marks a transaction as failed by attempting to update its status
   * and gracefully handling cases where the transaction is already marked as failed.
   *
   * @param {number} transactionId - The unique identifier of the transaction to be marked as failed.
   * @param {TransactionClientContract} trx - The database transaction client to be used for the operation.
   * @return {Promise<void>} Resolves when the operation is complete, or throws an error if it fails.
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
   * Safely marks a payment as failed by interacting with the payment service.
   * If the payment is already marked as failed, logs the occurrence and skips further processing.
   *
   * @param {number} paymentId - The unique identifier of the payment to be marked as failed.
   * @param {any} operatorResponse - The response object from the operator, containing details about the failure.
   * @param {TransactionClientContract} trx - The transaction client used for database operations.
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
   * Creates a success response object for a webhook request.
   *
   * @return {WebhookResponseDto} An object containing a status code of 200 and a message indicating success.
   */
  private createSuccessResponse(): WebhookResponseDto {
    return { status: 200, message: 'received' }
  }
}
