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

@inject()
export default class HandleTransfertInterSecondWebhookUseCase extends BaseWebhookHandler {
  /**
   * Constructor for initializing dependencies required for the class.
   *
   * @param {PaymentService} paymentService An instance of the payment service used for handling payment-related operations.
   * @param {TransactionService} transactionService An instance of the transaction service used for managing transactions.
   * @param {WalletService} walletService An instance of the wallet service used for wallet-related operations.
   * @param {LedgerService} ledgerService An instance of the ledger service used for managing ledger-related tasks.
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
   * Executes the second step of an inter-transfer operation, triggered by a webhook event.
   *
   * @param {WebhookRequestDto} payload - The payload received from the webhook, containing transaction details and reference information.
   * @param {TransactionStatus} status - The current transaction status provided in the webhook.
   * @return {Promise<WebhookResponseDto>} A promise that resolves to the response of the webhook process indicating success or failure.
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
      const { transaction, secondPayment, wallet } = await this.loadInterSecondEntities(
        reference,
        trx
      )

      if (this.isIdempotent(transaction, secondPayment, status)) {
        paymentLog.warn(
          'INTER_TRANSFER_SECOND_IDEMPOTENT',
          { webhook: { reference } },
          'Inter-transfer second step is idempotent, acknowledging'
        )
        return WEBHOOK_SUCCESS_RESPONSE
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

      paymentLog.info(
        'INTER_TRANSFER_SECOND_SUCCESS',
        { webhook: { reference, status } },
        'Inter-transfer second step processed successfully'
      )
      return WEBHOOK_SUCCESS_RESPONSE
    })
  }

  /**
   * Loads and retrieves the transaction, second payment, and wallet entities associated with a specific reference.
   *
   * @param {string} reference - The reference identifier for the transaction to be loaded.
   * @param {TransactionClientContract} trx - The transaction client used to manage the database transaction.
   * @return {Promise<{transaction: Transaction, secondPayment: Payment, wallet: Wallet}>}
   * Resolves with an object containing the transaction, second payment, and wallet, or throws an exception if the second payment is not found.
   */
  private async loadInterSecondEntities(
    reference: string,
    trx: TransactionClientContract
  ): Promise<{
    transaction: Transaction
    secondPayment: Payment
    wallet: Wallet
  }> {
    const {
      transaction,
      payment: secondPayment,
      wallet,
    } = await this.loadTransactionWithWallet(reference, this.walletService, trx, 1)

    if (!secondPayment) {
      throw new Exception('Invalid inter-transfer payments structure (missing second step)', {
        status: 400,
        code: 'INTER_TRANSFER_INVALID_PAYMENTS',
      })
    }

    return { transaction, secondPayment, wallet }
  }

  /**
   * Processes the second step of a transaction by handling success or failure scenarios
   * based on the given transaction status and updates the necessary records accordingly.
   *
   * @param {Transaction} transaction - The transaction object containing transaction details.
   * @param {Payment} secondPayment - The payment object representing the second payment involved.
   * @param {Wallet} wallet - The wallet object associated with the transaction.
   * @param {any} operatorResponse - The response received from the operator or external system.
   * @param {TransactionStatus} status - The status of the transaction indicating success or failure.
   * @param {TransactionClientContract} trx - The transaction client contract used for database operations.
   * @return {Promise<void>} A promise that resolves when the process is complete.
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

      const beneficiaryPhone = this.extractBeneficiaryPhone(secondPayment)

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

  /**
   * Extracts the beneficiary's phone number from the payment details.
   *
   * @param payment The payment object containing payment details.
   * @return The extracted phone number as a string, or 'unknown' if unavailable or an error occurs.
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
