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

/**
 * Use case for handling the second webhook for inter-transfer payments.
 * It manages the state and processing logic for the second step of a
 * payment transfer operation, ensuring proper handling of success or failure states.
 */
@inject()
export default class HandleTransfertInterSecondWebhookUseCase {
  /**
   * Creates an instance of the class with the necessary services.
   *
   * @param {PaymentService} paymentService - Service to handle payment-related operations.
   * @param {TransactionService} transactionService - Service to manage transaction-related functionalities.
   * @param {WalletService} walletService - Service for wallet operations and management.
   * @param ledgerService
   */
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {}

  /**
   * Executes the second step of an inter-transfer operation based on the given payload and status.
   *
   * @param {WebhookRequestDto} payload - The request payload containing necessary information for processing.
   * @param {'success' | 'failed'} status - The status of the operation indicating success or failure.
   * @return {Promise<WebhookResponseDto>} The response generated after processing the webhook request.
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
    this.validatePayload(payload)

    const reference = payload.data.reference
    const operatorResponse = payload.data
    paymentLog.debug(
      'INTER_TRANSFER_SECOND_VALIDATED',
      { webhook: { reference, status } },
      'Inter-transfer second webhook validated'
    )
    const trx = await db.transaction()

    try {
      const { transaction, payments, wallet } = await this.loadEntities(reference, trx)
      paymentLog.debug(
        'INTER_TRANSFER_SECOND_ENTITIES_LOADED',
        {
          webhook: { reference },
          transaction: { id: transaction.id },
          payments: { count: payments.length },
          wallet: { id: wallet.id },
        },
        'Loaded transaction, payments and wallet for inter-transfer second step'
      )
      const secondPayment = payments[1]

      if (!secondPayment) {
        throw new Exception('Invalid inter-transfer payments structure (missing second step)', {
          status: 400,
          code: 'INTER_TRANSFER_INVALID_PAYMENTS',
        })
      }

      const idempotent = this.isIdempotentRequest(transaction, secondPayment, status)
      paymentLog.debug(
        'INTER_TRANSFER_SECOND_IDEMPOTENCY_CHECK',
        {
          webhook: { reference, incomingStatus: status },
          payment: { id: secondPayment?.id, status: secondPayment?.status },
          idempotent,
        },
        'Inter-transfer second step idempotency check'
      )

      if (idempotent) {
        await trx.commit()
        paymentLog.info(
          'INTER_TRANSFER_SECOND_IDEMPOTENT',
          { webhook: { reference } },
          'Inter-transfer second step is idempotent, acknowledging'
        )
        return this.createSuccessResponse()
      }

      paymentLog.info(
        'INTER_TRANSFER_SECOND_PROCESSING',
        { webhook: { reference, status }, payment: { id: secondPayment.id } },
        'Processing inter-transfer second step'
      )

      const result = await this.processSecondStep(
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
      return result
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Validates the payload of a webhook request to ensure it contains the required data.
   *
   * @param {WebhookRequestDto} payload - The webhook request data transfer object to be validated.
   * @return {void} Throws an exception if the payload is invalid.
   */
  private validatePayload(payload: WebhookRequestDto): void {
    if (!payload?.data?.reference) {
      paymentLog.warn(
        'WEBHOOK_REFERENCE_REQUIRED',
        {
          webhook: payload?.data,
        },
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
        {
          webhook: payload?.data,
        },
        'Missing status in inter-transfer second webhook'
      )
      throw new Exception('Invalid payload: Missing status', {
        status: 422,
        code: 'INVALID_WEBHOOK_PAYLOAD',
      })
    }
  }

  /**
   * Loads entities related to a specific reference, including transaction, payments, and wallet.
   *
   * @param {string} reference - The reference identifier for which entities will be fetched.
   * @param {TransactionClientContract} trx - The transaction client contract.
   * @return {Promise<{transaction: Transaction, payments: Payment[], wallet: Wallet}>}
   *         A promise resolving to an object containing the transaction, an array of associated payments, and the user's wallet.
   */
  private async loadEntities(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{
    transaction: Transaction
    payments: Payment[]
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
      return { transaction, payments, wallet }
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
   * Determines if a request is idempotent by comparing the current state of the transaction
   * and payment with the incoming status.
   *
   * @param {Transaction} transaction - The transaction object containing its current state.
   * @param {Payment} payment - The payment object containing its current status.
   * @param {'success' | 'failed'} incomingStatus - The incoming status of the request.
   * @return {boolean} Returns true if the request is idempotent, otherwise false.
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
   * Processes the second step of a transaction, updating the status of payments and transactions
   * according to the provided status.
   *
   * @param {Transaction} transaction - The main transaction that needs to be updated.
   * @param {Payment} secondPayment - The secondary payment object associated with the transaction.
   * @param {Wallet} wallet - The wallet associated with the transaction, holding the balance to update.
   * @param {any} operatorResponse - The response received from the operator after processing the transaction.
   * @param {'success' | 'failed'} status - The status of the transaction indicating success or failure.
   * @param {TransactionClientContract} trx - The transaction client used to handle database operations.
   * @return {Promise<WebhookResponseDto>} A promise that resolves to a webhook response DTO indicating the result of the operation.
   */
  private async processSecondStep(
    transaction: Transaction,
    secondPayment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    status: TransactionStatus,
    trx: TransactionClientContract
  ): Promise<WebhookResponseDto> {
    if (status === TransactionStatus.SUCCESS) {
      transactionLog.debug(
        'INTER_TRANSFER_SECOND_MARKING_PAYMENT_SUCCESS',
        { transaction: { reference: transaction.reference }, payment: { id: secondPayment.id } },
        'Marking second payment as success'
      )
      await this.paymentService.markSuccess(
        secondPayment.id,
        { operatorResponse: operatorResponse },
        trx
      )
      transactionLog.debug(
        'INTER_TRANSFER_SECOND_MARKING_TX_SUCCESS',
        {
          transaction: { reference: transaction.reference, id: transaction.id },
          wallet: { balanceAfter: wallet.balance },
        },
        'Marking transaction as success'
      )
      await this.transactionService.markSuccess(transaction.id, wallet.balance, trx)
      await this.ledgerService.recordExternalTransfer(
        transaction,
        wallet.id,
        wallet.balance,
        wallet.balance,
        trx
      )
      return this.createSuccessResponse()
    }

    if (status === TransactionStatus.FAILED) {
      transactionLog.debug(
        'INTER_TRANSFER_SECOND_MARKING_FAILED',
        { transaction: { reference: transaction.reference }, payment: { id: secondPayment.id } },
        'Marking second payment and transaction as failed'
      )
      // Séquentiel pour éviter les race conditions
      await this.transactionService.markFailed(transaction.id, trx)
      await this.paymentService.markFailed(
        secondPayment.id,
        { operatorResponse: operatorResponse },
        trx
      )

      // Dispatch failure event for transaction failure tracking
      const paymentDetails = (() => {
        try {
          const raw = (secondPayment as any)?.paymentDetails
          return typeof raw === 'string' ? JSON.parse(raw) : (raw ?? {})
        } catch {
          return {}
        }
      })()

      await TransfertInterTransactionFailed.dispatch({
        reference: transaction.reference,
        amount: transaction.amount,
        userId: transaction.usersUid,
        beneficiaryPhone: paymentDetails?.phone || 'unknown',
      })

      return this.createSuccessResponse()
    }

    return this.createSuccessResponse()
  }

  /**
   * Creates and returns a successful response object.
   *
   * @return {WebhookResponseDto} The response object containing a status code of 200 and a success message.
   */
  private createSuccessResponse(): WebhookResponseDto {
    return { status: 200, message: 'received' }
  }
}
