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
import DepositTransactionCompleted from '#features/webhooks/application/events/deposit/deposit_transaction_completed'
import DepositTransactionFailed, {
  DepositTransactionFailedPayload,
} from '#features/webhooks/application/events/deposit/deposit_transaction_failed'
import paymentLog from '#shared/infrastructure/logging/payment_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import WalletService from '#features/wallet/application/services/wallet_service'
import WalletAdjustException from '#features/wallet/infrastructure/exceptions/wallet_adjust_exception'
import BaseWebhookHandler, { WEBHOOK_SUCCESS_RESPONSE } from './base_webhook_handler.js'
import emitter from '@adonisjs/core/services/emitter'

@inject()
export default class HandleDepositWebhookUseCase extends BaseWebhookHandler {
  /**
   * Initializes a new instance of the class with the provided services.
   *
   * @param {PaymentService} paymentService - The service responsible for handling payment-related operations.
   * @param {TransactionService} transactionService - The service responsible for handling transaction-related operations.
   * @param {WalletService} walletService - The service responsible for handling wallet-related operations.
   * @param {LedgerService} ledgerService - The service responsible for handling ledger-related operations.
   *
   * */
  constructor(
    protected readonly paymentService: PaymentService,
    protected readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {
    super()
  }

  /**
   * Handles the execution of a webhook request, processes the transaction based on the provided status,
   * and returns a response indicating the result of the operation.
   *
   * @param {WebhookRequestDto} payload - The request payload containing webhook data, including the transaction reference.
   * @param {TransactionStatus} status - The status of the transaction from the webhook, indicating success, failure, or other states.
   * @return {Promise<WebhookResponseDto>} A promise resolving to the response object indicating the result of the webhook processing.
   */
  async execute(
    payload: WebhookRequestDto,
    status: TransactionStatus
  ): Promise<WebhookResponseDto> {
    this.validatePayload(payload)
    const { reference } = payload.data

    paymentLog.info(
      'DEPOSIT_WEBHOOK_RECEIVED',
      { webhook: { reference, status } },
      'Received deposit webhook'
    )

    return this.withTransaction(async (trx) => {
      const { transaction, payment } = await this.loadTransactionWithPayment(reference, trx)

      if (this.isIdempotent(transaction, payment, status)) {
        paymentLog.warn(
          'DEPOSIT_WEBHOOK_IDEMPOTENT',
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
          await this.processSuccessfulDeposit(transaction, payment, wallet, operatorResponse, trx)
          break
        case TransactionStatus.FAILED:
          await this.processFailedDeposit(transaction, payment, operatorResponse, trx)
          break
        default:
          paymentLog.warn(
            'DEPOSIT_WEBHOOK_UNKNOWN_STATUS',
            { webhook: { reference, status } },
            'Webhook received with unhandled status'
          )
          break
      }

      paymentLog.info(
        'DEPOSIT_WEBHOOK_PROCESSED',
        { webhook: { reference, status } },
        'Deposit webhook processed successfully'
      )
      return WEBHOOK_SUCCESS_RESPONSE
    })
  }

  /**
   * Processes a successful deposit transaction by updating payment status, crediting the user's wallet,
   * updating the transaction status, recording the transaction in the ledger, and dispatching a completion event.
   *
   * @param {Transaction} transaction - The deposit transaction details.
   * @param {Payment} payment - The payment object associated with the transaction.
   * @param {Wallet} wallet - The user's wallet to be credited.
   * @param {any} operatorResponse - The response received from the payment operator.
   * @param {TransactionClientContract} trx - The database transaction client used for performing atomic operations.
   * @return {Promise<void>} A promise that resolves when all operations are successfully completed.
   */
  private async processSuccessfulDeposit(
    transaction: Transaction,
    payment: Payment,
    wallet: Wallet,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    await this.safeMarkPaymentSuccess(payment.id, operatorResponse, trx)

    const creditAmount = Number(transaction.totalAmount || 0)
    const updatedWallet = await this.walletService.creditBalance(wallet.id, creditAmount, trx)

    if (
      !updatedWallet?.id ||
      updatedWallet.balance === null ||
      updatedWallet.balance === undefined
    ) {
      errorLog.error(
        'DEPOSIT_WALLET_CREDIT_FAILED',
        {
          wallet: { id: wallet.id, creditAmount, currentBalance: wallet.balance },
          transaction_id: transaction.id,
        },
        'CRITICAL: Failed to credit wallet during deposit'
      )
      throw new WalletAdjustException()
    }

    await this.safeMarkTransactionSuccess(transaction.id, updatedWallet.balance!, trx)

    await this.ledgerService.recordDeposit(
      transaction,
      wallet.id,
      wallet.balance,
      updatedWallet.balance,
      trx
    )

    emitter.emit('activity:transaction-log', {
      event: 'WALLET_CREDITED',
      transactionId: transaction.reference,
      walletId: String(wallet.id),
      amount: creditAmount,
      balanceBefore: Number(wallet.balance),
      balanceAfter: updatedWallet.balance!,
    })

    emitter.emit('activity:transaction-log', {
      event: 'SUCCESS',
      transactionId: transaction.reference,
    })

    this.dispatchEvent(
      DepositTransactionCompleted,
      {
        reference: transaction.reference,
        amount: transaction.amount,
        userId: transaction.usersUid,
        balanceAfter: updatedWallet.balance || 0,
      },
      'DEPOSIT_COMPLETED',
      transaction.reference
    )
  }

  /**
   * Processes a failed deposit by marking the transaction and payment as failed in the system
   * and dispatching the appropriate event with failure details.
   *
   * @param {Transaction} transaction - The transaction object representing the failed deposit.
   * @param {Payment} payment - The payment object associated with the failed deposit.
   * @param {any} operatorResponse - The response received from the payment operator.
   * @param {TransactionClientContract} trx - The transaction client contract used for database operations.
   * @return {Promise<void>} A promise that resolves once the failed deposit has been fully processed.
   */
  private async processFailedDeposit(
    transaction: Transaction,
    payment: Payment,
    operatorResponse: any,
    trx: TransactionClientContract
  ): Promise<void> {
    paymentLog.info(
      'DEPOSIT_FAILURE_PROCESSING',
      { transaction_id: transaction.id, payment_id: payment.id },
      'Processing failed deposit'
    )

    await this.safeMarkTransactionFailed(transaction.id, trx)
    await this.safeMarkPaymentFailed(payment.id, operatorResponse, trx)

    emitter.emit('activity:transaction-log', {
      event: 'FAILED',
      transactionId: transaction.reference,
      errorMessage: 'Payment failed via webhook',
    })

    this.dispatchEvent(
      DepositTransactionFailed,
      <DepositTransactionFailedPayload>{
        reference: transaction.reference,
        amount: transaction.amount,
        userId: transaction.usersUid,
      },
      'DEPOSIT_FAILED',
      transaction.reference
    )
  }
}
