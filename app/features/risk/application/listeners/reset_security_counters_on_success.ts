import { inject } from '@adonisjs/core'
import TransactionThrottleCache from '#features/risk/domain/interfaces/transaction_throttle_cache'
import TransactionFailureCache from '#features/risk/domain/interfaces/transaction_failure_cache'
import DepositTransactionCompleted from '#features/transactions/application/events/deposit_transaction_completed'
import TransfertTransactionCompleted from '#features/transactions/application/events/transfert_transaction_completed'
import WalletToWalletTransactionCompleted from '#features/transactions/application/events/wallet_to_wallet_transaction_completed'

/**
 * Listener `risk` (anti-abus) — réinitialise les compteurs de vélocité/échec sur un succès de
 * transaction. Abonné aux mêmes events `*Completed` que le listener de volume (money) : deux
 * consommateurs indépendants sur le même « topic » (cf. ADR-0014). Au split micro-services, ce
 * listener devient un consumer Kafka de la sécurité.
 *
 * Idempotent (setLastSuccessTime = set, resetFailures = reset) : pas de garde d'idempotence
 * nécessaire, contrairement à l'incrément de volume.
 */
@inject()
export default class ResetSecurityCountersOnSuccess {
  constructor(
    private readonly throttleCache: TransactionThrottleCache,
    private readonly failureCache: TransactionFailureCache
  ) {}

  async handle(
    event:
      | DepositTransactionCompleted
      | TransfertTransactionCompleted
      | WalletToWalletTransactionCompleted
  ) {
    if (event instanceof WalletToWalletTransactionCompleted) {
      const { senderTransaction: sTx, receiverTransaction: rTx } = event
      await Promise.all([
        this.reset(sTx.usersUid, sTx.createdAt),
        this.reset(rTx.usersUid, rTx.createdAt),
      ])
      return
    }

    const { userId } = event.data
    await this.reset(userId)
  }

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
