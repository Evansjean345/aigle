import { inject } from '@adonisjs/core'
import PaymentService from '#features/transactions/application/services/payment_service'
import TransactionService from '#features/transactions/application/services/transaction_service'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
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
import WalletAdjustException from '#features/wallet/infrastructure/exceptions/wallet_adjust_exception'
import BaseWebhookHandler, { WEBHOOK_SUCCESS_RESPONSE } from './base_webhook_handler.js'

@inject()
export default class HandleTransfertWebhookUseCase extends BaseWebhookHandler {
  /**
   * Constructs an instance of the class with the given service dependencies.
   *
   * @param {PaymentService} paymentService - The service responsible for handling payment operations.
   * @param {TransactionService} transactionService - The service used to manage transaction-related processes.
   * @param {WalletService} walletService - The service managing wallet-related functionality.
   * @param {LedgerService} ledgerService - The service responsible for maintaining ledger management and operations.
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
   * Processes a transfer webhook by validating the payload, loading associated transaction details,
   * and performing the appropriate actions based on the transaction status.
   *
   * @param {WebhookRequestDto} payload - The payload received from the webhook, containing transaction details.
   * @param {TransactionStatus} status - The status of the transaction as indicated by the webhook.
   * @return {Promise<WebhookResponseDto>} A promise resolving to the response object for the webhook.
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

    return this.withTransaction(async (trx) => {
      const { transaction, payment } = await this.loadTransactionWithPayment(reference, trx)

      if (this.isIdempotent(transaction, payment, status)) {
        paymentLog.warn(
          'TRANSFER_WEBHOOK_IDEMPOTENT',
          {
            webhook: { reference, incomingStatus: status },
            transaction: { status: transaction.status },
            payment: { status: payment.status },
          },
          'Idempotent webhook call — skipping processing'
        )
        return WEBHOOK_SUCCESS_RESPONSE
      }

      const wallet = await this.loadWallet(this.walletService, transaction, trx)
      const operatorResponse = this.buildOperatorResponse(payload)

      switch (status) {
        case TransactionStatus.SUCCESS:
          await this.processSuccessfulTransfer(transaction, payment, wallet, operatorResponse, trx)
          break
        case TransactionStatus.FAILED:
          await this.processFailedTransfer(transaction, payment, wallet, operatorResponse, trx)
          break
        default:
          paymentLog.warn(
            'TRANSFER_WEBHOOK_UNKNOWN_STATUS',
            { webhook: { reference, status } },
            'Webhook received with unhandled status'
          )
          break
      }

      paymentLog.info(
        'TRANSFER_WEBHOOK_PROCESSED',
        { webhook: { reference, status } },
        'Transfer webhook processed successfully'
      )
      return WEBHOOK_SUCCESS_RESPONSE
    })
  }

  /**
   * Handles the successful processing of a transfer by updating payment and transaction statuses,
   * recording the transfer in the ledger, and dispatching a transfer completion event.
   *
   * @param {Transaction} transaction - The transaction object containing details of the transfer.
   * @param {Payment} payment - The payment object associated with the transfer.
   * @param {Wallet} wallet - The wallet of the user related to the transfer.
   * @param {any} operatorResponse - The response data received from the operator for the transfer.
   * @param {TransactionClientContract} trx - The database transaction object for ensuring atomicity.
   * @return {Promise<void>} A promise that resolves when all processing steps are completed.
   */
  private async processSuccessfulTransfer(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    const currentBalance = Number(wallet.balance)

    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)
    await this.safeMarkTransactionSuccess(transaction.id, currentBalance, trx)

    const balanceBefore = currentBalance + Number(transaction.amount)
    await this.ledgerService.recordTransfer(
      transaction,
      wallet.id,
      balanceBefore,
      currentBalance,
      trx
    )

    this.dispatchEvent(
      TransfertTransactionCompleted,
      <TransfertTransactionCompletedPayload>{
        reference: transaction.reference,
        amount: transaction.amount,
        userId: transaction.usersUid,
        balanceAfter: currentBalance,
        beneficiaryPhone: this.paymentService.extractBeneficiaryPhone(payment),
      },
      'TRANSFER_COMPLETED',
      transaction.reference
    )
  }

  /**
   * Handles the processing of a failed transfer by marking the transaction and payment as failed,
   * refunding the wallet balance, and recording the reversal in the ledger.
   *
   * @param {Transaction} transaction - The transaction object representing the failed transfer.
   * @param {Payment} payment - The payment object associated with the failed transaction.
   * @param {Wallet} wallet - The wallet object to be credited with the refund.
   * @param {any} operatorResponse - The response object from the operator detailing the failure.
   * @param {TransactionClientContract} trx - The transaction client contract for database operations.
   * @return {Promise<void>} A promise that resolves when the failed transfer has been successfully processed.
   * @throws {WalletAdjustException} If the wallet refund fails during processing.
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

    await this.safeMarkTransactionFailed(transaction.id, trx)
    await this.safeMarkPaymentFailed(payment.id, operatorResponse, trx)

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
}
