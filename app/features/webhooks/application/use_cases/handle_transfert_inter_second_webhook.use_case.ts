import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import WalletService from '#features/wallet/application/services/wallet_service'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import Payment from '#features/transactions/domain/models/payment'
import Wallet from '#features/wallet/domain/models/wallet'
import { WebhookRequestDto } from '#features/webhooks/application/dto/webhook_request.dto'
import { WebhookResponseDto } from '#features/webhooks/application/dto/webhook_response.dto'
import LedgerService from '#features/ledger/application/services/ledger_service'
import transactionLog from '#shared/infrastructure/logging/transaction_log'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import TransfertInterTransactionFailed from '#features/webhooks/application/events/transfert_inter/transfert_inter_transaction_failed'
import BaseWebhookHandler, { WEBHOOK_SUCCESS_RESPONSE } from './base_webhook_handler.js'
import emitter from '@adonisjs/core/services/emitter'

@inject()
export default class HandleTransfertInterSecondWebhookUseCase extends BaseWebhookHandler {
  /**
   * Initializes a new instance of the class, providing required services for payments, transactions, wallets, and ledgers.
   *
   * @param {PaymentService} paymentService An instance of the payment service to handle payment operations.
   * @param {TransactionService} transactionService An instance of the transaction service to manage transaction-related logic.
   * @param {WalletService} walletService An instance of the wallet service to handle wallet-related operations.
   * @param {LedgerService} ledgerService An instance of the ledger service to manage ledger-related tasks.
   */
  constructor(
    protected readonly paymentService: PaymentService,
    protected readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {
    super()
  }

  /**
   * Executes the second step of an inter-transfer webhook process. Validates the incoming request payload, performs necessary processing,
   * and ensures idempotency to handle duplicate requests effectively.
   *
   * @param {WebhookRequestDto} payload - The incoming webhook request data containing transaction details.
   * @param {TransactionStatus} status - The current status of the transaction, indicating the phase of processing.
   * @return {Promise<WebhookResponseDto>} A promise that resolves to a response object indicating the result of the webhook processing.
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
    const operatorResponse = this.buildOperatorResponse(payload)

    return this.withTransaction(async (trx) => {
      const { transaction, secondPayment } = await this.loadInterSecondEntities(reference, trx)

      if (this.isIdempotent(transaction, secondPayment, status)) {
        paymentLog.warn(
          'INTER_TRANSFER_SECOND_IDEMPOTENT',
          { webhook: { reference } },
          'Inter-transfer second step is idempotent, acknowledging'
        )
        return WEBHOOK_SUCCESS_RESPONSE
      }

      const wallet = await this.loadWallet(this.walletService, transaction, trx)

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

      paymentLog.info(
        'INTER_TRANSFER_SECOND_SUCCESS',
        { webhook: { reference, status } },
        'Inter-transfer second step processed successfully'
      )
      return WEBHOOK_SUCCESS_RESPONSE
    })
  }

  /**
   * Loads and validates entities related to the second step of an inter-transfer payment process.
   *
   * @param {string} reference - The unique reference identifier for the transaction.
   * @param {TransactionClientContract} trx - The database transaction instance for managing transactional consistency.
   * @return {Promise<{transaction: Transaction, secondPayment: Payment, wallet: Wallet}>}
   *         A promise resolving to an object containing the transaction, second payment, and associated wallet.
   * @throws {Exception} Throws an exception if the second payment is missing, indicating an invalid inter-transfer structure.
   */
  private async loadInterSecondEntities(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{
    transaction: Transaction
    secondPayment: Payment
  }> {
    const { transaction, payment: secondPayment } = await this.loadTransactionWithPayment(
      reference,
      trx,
      1
    )

    if (!secondPayment) {
      throw new Exception('Invalid inter-transfer payments structure (missing second step)', {
        status: 400,
        code: 'INTER_TRANSFER_INVALID_PAYMENTS',
      })
    }

    return { transaction, secondPayment }
  }

  /**
   * Processes the second step of a transaction, handling success or failure of the second payment
   * and updating the respective states of the transaction and payment.
   *
   * @param {Transaction} transaction - The main transaction object associated with the operation.
   * @param {Payment} secondPayment - The payment object for the second step of the transaction.
   * @param {Wallet} wallet - The wallet involved in the transaction.
   * @param {any} operatorResponse - The response received from the operator.
   * @param {TransactionStatus} status - The current status of the transaction (SUCCESS or FAILED).
   * @param {TransactionClientContract} trx - The transaction client used for database operations.
   * @return {Promise<void>} A promise that resolves when the second step processing is completed.
   */
  private async processSecondStep(
    transaction: Transaction,
    secondPayment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    status: TransactionStatus,
    trx: TransactionClientContract
  ): Promise<void> {
    if (status === TransactionStatus.SUCCESS) {
      await this.safeMarkPaymentSuccess(secondPayment.id, operatorResponse, trx)
      await this.safeMarkTransactionSuccess(transaction.id, wallet.balance, trx)

      await this.ledgerService.recordExternalTransfer(
        transaction,
        wallet.id,
        wallet.balance,
        wallet.balance,
        trx
      )

      emitter.emit('activity:transaction-log', {
        event: 'SUCCESS',
        transactionId: transaction.reference,
      })
      return
    }

    if (status === TransactionStatus.FAILED) {
      transactionLog.debug(
        'INTER_TRANSFER_SECOND_MARKING_FAILED',
        {
          transaction: { reference: transaction.reference, id: transaction.id },
          payment: { id: secondPayment.id },
        },
        'Marking second payment and transaction as failed'
      )

      await this.safeMarkPaymentFailed(secondPayment.id, operatorResponse, trx)
      await this.safeMarkTransactionFailed(transaction.id, trx)

      emitter.emit('activity:transaction-log', {
        event: 'FAILED',
        transactionId: transaction.reference,
        errorMessage: 'Inter-transfer second step failed via webhook',
      })

      const beneficiaryPhone = this.paymentService.extractBeneficiaryPhone(secondPayment)

      this.dispatchEvent(
        TransfertInterTransactionFailed,
        {
          reference: transaction.reference,
          amount: transaction.amount,
          userId: transaction.usersUid,
          beneficiaryPhone,
        },
        'INTER_TRANSFER_FAILED',
        transaction.reference
      )
      return
    }

    paymentLog.warn(
      'INTER_TRANSFER_SECOND_UNEXPECTED_STATUS',
      { webhook: { reference: transaction.reference, status } },
      `Unexpected status received: ${status}`
    )
  }
}
