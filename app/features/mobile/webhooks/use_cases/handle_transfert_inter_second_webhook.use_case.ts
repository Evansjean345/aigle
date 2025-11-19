import { inject } from '@adonisjs/core'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import WalletService from '#mobile/wallet/services/wallet_service'
import { Exception } from '@adonisjs/core/exceptions'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import Transaction from '#features/transactions/domain/models/transaction'
import Payment from '#features/transactions/domain/models/payment'
import Wallet from '#features/wallet/domain/models/wallet'
import { WebhookRequestDto } from '#mobile/webhooks/dto/webhook_request.dto'
import { WebhookResponseDto } from '#mobile/webhooks/dto/webhook_response.dto'
import { Logger } from '@adonisjs/core/logger'

/**
 * Use case for handling the second webhook for inter-transfer payments.
 * It manages the state and processing logic for the second step of a
 * payment transfer operation, ensuring proper handling of success or failure states.
 */
@inject()
export default class HandleTransfertInterSecondWebhookUseCase {
  /**
   * Creates an instance of the class with the necessary services and a logger.
   *
   * @param {PaymentService} paymentService - Service to handle payment-related operations.
   * @param {TransactionService} transactionService - Service to manage transaction-related functionalities.
   * @param {WalletService} walletService - Service for wallet operations and management.
   * @param {Logger} logger - Logging service for capturing logs and debugging information.
   */
  constructor(
    private readonly paymentService: PaymentService,
    private readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly logger: Logger
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
    status: 'success' | 'failed'
  ): Promise<WebhookResponseDto> {
    this.logger.info({ status, payload }, 'Inter-transfer second webhook received')
    this.validatePayload(payload)

    const reference = payload.data.reference
    const operatorResponse = payload.data
    this.logger.debug({ reference, status }, 'Inter-transfer second webhook validated')
    const trx = await db.transaction()

    try {
      const { transaction, payments, wallet } = await this.loadEntities(reference)
      this.logger.debug(
        {
          reference,
          transaction_id: transaction.id,
          payments_count: payments.length,
          wallet_id: wallet.id,
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
      this.logger.debug(
        {
          reference,
          second_payment_id: secondPayment?.id,
          current_payment_status: secondPayment?.status,
          incoming_status: status,
          idempotent,
        },
        'Inter-transfer second step idempotency check'
      )

      if (idempotent) {
        await trx.commit()
        this.logger.info({ reference }, 'Inter-transfer second step is idempotent, acknowledging')
        return this.createSuccessResponse()
      }

      this.logger.info(
        { reference, second_payment_id: secondPayment.id, status },
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
      this.logger.info({ reference, status }, 'Inter-transfer second step processed')
      return result
    } catch (error) {
      await trx.rollback()
      this.logger.error({ err: error, payload }, 'Inter-transfer second step webhook failed')
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
      throw new Exception('Invalid payload', { status: 422, code: 'INVALID_WEBHOOK_PAYLOAD' })
    }
  }

  /**
   * Loads entities related to a specific reference, including transaction, payments, and wallet.
   *
   * @param {string} reference - The reference identifier for which entities will be fetched.
   * @return {Promise<{transaction: Transaction, payments: Payment[], wallet: Wallet}>}
   *         A promise resolving to an object containing the transaction, an array of associated payments, and the user's wallet.
   */
  private async loadEntities(reference: string): Promise<{
    transaction: Transaction
    payments: Payment[]
    wallet: Wallet
  }> {
    const transaction = await this.transactionService.findByReference(reference)
    const payments = await this.paymentService.findByTransaction(transaction.transactionsUid)
    const wallet = await this.walletService.getByUserId(transaction.usersUid)
    return { transaction, payments, wallet }
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
    incomingStatus: 'success' | 'failed'
  ): boolean {
    if (payment.status === 'success' && incomingStatus === 'success') return true
    if (payment.status === 'failed' && incomingStatus === 'failed') return true
    return transaction.status !== 'pending'
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
    status: 'success' | 'failed',
    trx: TransactionClientContract
  ): Promise<WebhookResponseDto> {
    if (status === 'success') {
      this.logger.debug(
        { reference: transaction.reference, second_payment_id: secondPayment.id },
        'Marking second payment as success'
      )
      await this.paymentService.markSuccess(
        secondPayment.id,
        { operator_response: operatorResponse },
        trx
      )
      this.logger.debug(
        {
          reference: transaction.reference,
          transaction_id: transaction.id,
          balance_after: wallet.balance,
        },
        'Marking transaction as success'
      )
      await this.transactionService.markSuccess(transaction.id, wallet.balance, trx)
      return this.createSuccessResponse()
    } else {
      this.logger.debug(
        { reference: transaction.reference, second_payment_id: secondPayment.id },
        'Marking second payment and transaction as failed'
      )
      await this.paymentService.markFailed(
        secondPayment.id,
        { operator_response: operatorResponse },
        trx
      )
      await this.transactionService.markFailed(transaction.id, trx)
      return this.createSuccessResponse()
    }
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
