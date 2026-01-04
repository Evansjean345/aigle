import TransactionVolumeCache from '#features/transactions/domain/interfaces/transaction_volume_cache'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'
import { inject } from '@adonisjs/core'
import DepositTransactionCompleted from '#features/webhooks/application/events/deposit/deposit_transaction_completed'
import TransfertTransactionCompleted from '#features/webhooks/application/events/transfert/transfert_transaction_completed'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'

@inject()
export default class PersistUserTransactionsVolume {
  /**
   * Constructs an instance of the class.
   *
   * @param {TransactionVolumeCache} transactionVolumeCache - A cache instance for managing transaction volumes.
   * @param {IdempotencyProvider} idempotency - A provider for handling idempotency.
   */
  constructor(
    private readonly transactionVolumeCache: TransactionVolumeCache,
    private readonly idempotency: IdempotencyProvider
  ) {}

  /**
   * Handles various transaction events, updating the model accordingly based on
   * the type of transaction: deposit, transfer, or wallet-to-wallet.
   *
   * @param {DepositTransactionCompleted | TransfertTransactionCompleted | WalletToWalletTransactionCompleted} event
   *        The transaction event to be processed.
   *        - DepositTransactionCompleted: Represents a deposit event, where the user's balance is incremented.
   *        - TransfertTransactionCompleted: Represents a transfer event triggered via webhook, where the initiator's balance is incremented.
   *        - WalletToWalletTransactionCompleted: Represents a wallet-to-wallet transfer, where both sender's and receiver's balances are updated.
   */
  async handle(
    event:
      | DepositTransactionCompleted
      | TransfertTransactionCompleted
      | WalletToWalletTransactionCompleted
  ) {
    console.log('handle event :', event)

    if (event instanceof WalletToWalletTransactionCompleted) {
      const { senderTransaction: sTx, receiverTransaction: rTx } = event

      await Promise.all([
        this.persistFromTransactionModel(sTx.reference, sTx.usersUid, sTx.amount, sTx.createdAt),
        this.persistFromTransactionModel(rTx.reference, rTx.usersUid, rTx.amount, rTx.createdAt),
      ])
      return
    }

    if (event instanceof DepositTransactionCompleted) {
      const { userId, amount, reference } = event.data
      await this.persist(reference, userId, amount)
      return
    }

    if (event instanceof TransfertTransactionCompleted) {
      const { userId, amount, reference } = event.data
      await this.persist(reference, userId, amount)
      return
    }
  }

  /**
   * Persists the transaction details by marking it as processed and incrementing the transaction volume on success.
   *
   * @param {string} reference The unique identifier for the transaction.
   * @param {string} userId The user ID associated with the transaction.
   * @param {number} amount The amount involved in the transaction.
   * @param {Date | string | import('luxon').DateTime} [timestamp] The timestamp of the transaction. Can be a Date object, an ISO string, or a Luxon DateTime.
   * @return {Promise<void>} A promise that resolves once the transaction is processed and the volume is updated.
   */
  private async persist(
    reference: string,
    userId: string,
    amount: number,
    timestamp?: Date | string | import('luxon').DateTime
  ): Promise<void> {
    const ok = await this.idempotency.checkAndMark(reference)
    if (!ok) return

    await this.transactionVolumeCache.incrementOnSuccess({ userId, amount, timestamp })
  }

  /**
   * Persists transaction data based on the provided model information.
   *
   * @param {string} reference - The reference identifier for the transaction.
   * @param {string} usersUid - The unique identifier of the user associated with the transaction.
   * @param {number} amount - The monetary amount involved in the transaction.
   * @param {import('luxon').DateTime} [createdAt] - The optional date and time when the transaction was created.
   * @return {Promise<void>} A promise that resolves when the transaction data has been successfully persisted.
   */
  private async persistFromTransactionModel(
    reference: string,
    usersUid: string,
    amount: number,
    createdAt?: import('luxon').DateTime
  ): Promise<void> {
    await this.persist(reference, usersUid, amount, createdAt)
  }
}
