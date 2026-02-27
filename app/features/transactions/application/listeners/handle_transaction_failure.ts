import { inject } from '@adonisjs/core'
import TransactionFailureCache from '#features/transactions/domain/interfaces/transaction_failure_cache'
import DepositTransactionFailed from '#features/webhooks/application/events/deposit/deposit_transaction_failed'
import TransfertTransactionFailed from '#features/webhooks/application/events/transfert/transfert_transaction_failed'
import WalletToWalletTransactionFailed from '#features/operations/application/events/wallet_to_wallet_transaction_failed'
import TransfertInterTransactionFailed from '#features/webhooks/application/events/transfert_inter/transfert_inter_transaction_failed'

@inject()
export default class HandleTransactionFailure {
  /**
   * Constructs an instance of the class with the provided failure cache.
   *
   * @param {TransactionFailureCache} failureCache - The cache used to store transaction failures.
   */
  constructor(private failureCache: TransactionFailureCache) {}

  /**
   * Handles the given transaction failure event by increasing the failure count for the associated user.
   *
   * @param {DepositTransactionFailed | TransfertTransactionFailed | WalletToWalletTransactionFailed | TransfertInterTransactionFailed} event - The transaction failure event containing user-specific data.
   */
  async handle(
    event:
      | DepositTransactionFailed
      | TransfertTransactionFailed
      | WalletToWalletTransactionFailed
      | TransfertInterTransactionFailed
  ) {
    const userId = event.data.userId
    await this.failureCache.incrementFailure(userId)
  }
}
