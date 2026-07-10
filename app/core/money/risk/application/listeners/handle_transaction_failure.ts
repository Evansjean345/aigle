import { inject } from '@adonisjs/core'
import TransactionFailureCache from '#core/money/risk/domain/interfaces/transaction_failure_cache'
import DepositTransactionFailed from '#core/money/transactions/application/events/deposit_transaction_failed'
import TransfertTransactionFailed from '#core/money/transactions/application/events/transfert_transaction_failed'
import WalletToWalletTransactionFailed from '#core/money/transactions/application/events/wallet_to_wallet_transaction_failed'
import TransfertInterTransactionFailed from '#core/money/transactions/application/events/transfert_inter_transaction_failed'

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
    // Compteur d'échecs PAR USER : un checkout marchand échoué n'a pas de user (external-in,
    // aucun refund) → ignoré.
    if (event instanceof DepositTransactionFailed && event.data.type === 'checkout') return

    const userId = event.data.userId!
    await this.failureCache.incrementFailure(userId)
  }
}
