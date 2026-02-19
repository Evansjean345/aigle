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

@inject()
export default class HandleDepositWebhookUseCase extends BaseWebhookHandler {
  constructor(
    protected readonly paymentService: PaymentService,
    protected readonly transactionService: TransactionService,
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {
    super()
  }

  /**
   * Handles the execution of a deposit webhook by validating the payload, processing the transaction,
   * and managing the transaction status updates.
   *
   * @param {WebhookRequestDto} payload - The request data received from the webhook, including transaction details.
   * @param {TransactionStatus} status - The status of the transaction received in the webhook (e.g., SUCCESS, FAILED).
   * @return {Promise<WebhookResponseDto>} A response object indicating the result of webhook processing.
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
      const { transaction, payment, wallet } = await this.loadTransactionWithWallet(
        reference,
        this.walletService,
        trx
      )

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

      const operatorResponse = this.buildOperatorResponse(payload)

      if (status === TransactionStatus.SUCCESS) {
        await this.processSuccessfulDeposit(transaction, payment, wallet, operatorResponse, trx)
      } else if (status === TransactionStatus.FAILED) {
        await this.processFailedDeposit(transaction, payment, operatorResponse, trx)
      } else {
        paymentLog.warn(
          'DEPOSIT_WEBHOOK_UNKNOWN_STATUS',
          { webhook: { reference, status } },
          'Webhook received with unhandled status'
        )
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
   * Processes a successful deposit transaction by marking payment and transaction success, updating the wallet balance,
   * recording the deposit in the ledger, and dispatching a completion event.
   *
   * @param {Transaction} transaction - The transaction object containing details of the deposit.
   * @param {Payment} payment - The payment object corresponding to the deposit transaction.
   * @param {Wallet} wallet - The wallet object to be credited with the deposit amount.
   * @param {any} operatorResponse - The response received from the payment operator.
   * @param {TransactionClientContract} trx - The database transaction object for ensuring atomicity.
   * @return {Promise<void>} A promise that resolves once the deposit processing is successfully completed.
   * @throws {WalletAdjustException} If the wallet crediting operation fails.
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
   * Processes a failed deposit by marking the associated transaction and payment as failed and dispatching a failure event.
   *
   * @param {Transaction} transaction - The transaction object associated with the failed deposit.
   * @param {Payment} payment - The payment object associated with the failed deposit.
   * @param {any} operatorResponse - The operator's response data related to the failed deposit.
   * @param {TransactionClientContract} trx - The database transaction client to ensure atomicity.
   * @return {Promise<void>} A promise that resolves when the failed deposit processing is complete.
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
