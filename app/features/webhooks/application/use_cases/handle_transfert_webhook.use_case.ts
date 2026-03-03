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
import BaseWebhookHandler, {
  WEBHOOK_SUCCESS_RESPONSE,
} from '#features/webhooks/application/use_cases/base_webhook_handler'

@inject()
export default class HandleTransfertWebhookUseCase extends BaseWebhookHandler {
  /**
   * Constructs an instance of the class, initializing required services.
   *
   * @param {PaymentService} paymentService The service responsible for handling payment-related operations.
   * @param {TransactionService} transactionService The service responsible for managing transactions.
   * @param {WalletService} walletService The service for handling wallet-related operations.
   * @param {LedgerService} ledgerService The service for managing ledger entries and operations.
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
   * Handles a transfer webhook event.
   *
   * @param {WebhookRequestDto} payload - The webhook payload containing transaction details.
   * @param {TransactionStatus} status - The status of the transaction.
   * @return {Promise<WebhookResponseDto>} A promise that resolves with the webhook response.
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
      const { transaction, payment, wallet } = await this.loadTransactionWithWallet(
        reference,
        this.walletService,
        trx
      )

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

      const operatorResponse = this.buildOperatorResponse(payload)

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
   * Processes a successful transfer by updating the payment and transaction statuses, recording the transaction in the ledger,
   * and dispatching an event to signal the completion of the transfer.
   *
   * @param {Transaction} transaction - The transaction object containing details of the transfer.
   * @param {Payment} payment - The payment object representing the payment being processed.
   * @param {Wallet} wallet - The wallet object associated with the user performing the transfer.
   * @param {any} operatorResponse - The response received from the payment operator.
   * @param {TransactionClientContract} trx - The database transaction object to ensure atomic operations.
   * @return {Promise<void>} A promise that resolves when the processing of the successful transfer is complete.
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
        beneficiaryPhone: payment.paymentDetails?.phone || 'unknown',
      },
      'TRANSFER_COMPLETED',
      transaction.reference
    )
  }

  /**
   * Processes a failed transfer by marking the transaction and payment as failed,
   * refunding the wallet balance, and recording the reversal in the ledger.
   *
   * @param {Transaction} transaction - The transaction object related to the failed transfer.
   * @param {Payment} payment - The payment object associated with the failed transaction.
   * @param {Wallet} wallet - The wallet object to be credited with the refunded amount.
   * @param {any} operatorResponse - The response object from the operator detailing failure information.
   * @param {TransactionClientContract} trx - The database transaction context used for atomic operations.
   * @return {Promise<void>} A promise that resolves upon the successful processing of the failed transfer.
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
