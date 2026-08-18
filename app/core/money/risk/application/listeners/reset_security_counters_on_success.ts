import { inject } from '@adonisjs/core'
import TransactionThrottleCache from '#core/money/risk/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#core/money/risk/domain/interfaces/transaction_failure_cache'
import DepositTransactionCompleted from '#core/money/transactions/application/events/deposit_transaction_completed'
import TransfertTransactionCompleted from '#core/money/transactions/application/events/transfert_transaction_completed'
import WalletToWalletTransactionCompleted from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'

/**
 * Remet à zéro les compteurs anti-abus d'une personne dès qu'une de ses transactions aboutit.
 *
 * Poser le dernier succès et effacer les échecs donne le même état quel que soit le nombre de
 * passages : l'écouteur n'a pas besoin de garde d'idempotence.
 */
@inject()
export default class ResetSecurityCountersOnSuccess {
  /**
   * Construit l'écouteur.
   *
   * @param {TransactionThrottleCache} throttleCache - Date du dernier succès, par personne.
   * @param {TransactionFailureCache} failureCache - Compteur d'échecs consécutifs, par personne.
   */
  constructor(
    private readonly throttleCache: TransactionThrottleCache,
    private readonly failureCache: TransactionFailureCache
  ) {}

  /**
   * Réinitialise les compteurs des personnes concernées par la transaction aboutie.
   *
   * @param {DepositTransactionCompleted | TransfertTransactionCompleted | WalletToWalletTransactionCompleted} event - La transaction aboutie.
   * @returns {Promise<void>} Rien : une opération sans personne derrière ne remet rien à zéro.
   */
  async handle(
    event:
      | DepositTransactionCompleted
      | TransfertTransactionCompleted
      | WalletToWalletTransactionCompleted
  ): Promise<void> {
    if (event instanceof WalletToWalletTransactionCompleted) {
      // Seul l'émetteur est horodaté : le délai entre deux opérations vise celui qui les lance.
      // Horodater le bénéficiaire lui interdirait de transférer pendant une minute alors qu'il
      // n'a fait que recevoir.
      await this.reset(event.payload.sender.accountId, event.payload.sender.occurredAt)
      return
    }

    // Un encaissement marchand n'a personne derrière lui : il ne remet aucun compteur à zéro.
    if (event instanceof DepositTransactionCompleted && event.data.type === 'checkout') return

    const { userId } = event.data
    await this.reset(userId!)
  }

  /**
   * Pose le dernier succès et efface les échecs d'une personne.
   *
   * @param {string} userId - La personne. Pour un compte utilisateur, son identifiant vaut celui du compte.
   * @param {Date | string | import('luxon').DateTime} [timestamp] - Date du succès. Par défaut, maintenant.
   * @returns {Promise<void>} Rien.
   */
  private async reset(
    userId: string,
    timestamp?: Date | string | import('luxon').DateTime
  ): Promise<void> {
    await Promise.all([
      this.throttleCache.setLastSuccessTime(userId, timestamp),
      this.failureCache.resetFailures(userId),
    ])
  }
}
