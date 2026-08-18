import TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'
import IdempotencyProvider from '#core/money/transactions/domain/interfaces/idempotency_provider'
import { inject } from '@adonisjs/core'
import DepositTransactionCompleted from '#core/money/transactions/application/events/deposit_transaction_completed'
import TransfertTransactionCompleted from '#core/money/transactions/application/events/transfert_transaction_completed'
import WalletToWalletTransactionCompleted from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'

/**
 * Incrémente le volume de transactions (plafonds financiers = money-core) sur succès.
 *
 * NB : la mise à jour des compteurs anti-abus (dernier succès / reset des échecs) a été extraite
 * vers la feature `risk` (`ResetSecurityCountersOnSuccess`), abonnée aux mêmes events. Chaque
 * couche est autonome (cf. ADR-0014).
 */
@inject()
export default class PersistUserTransactionsVolume {
  constructor(
    private readonly transactionVolumeCache: TransactionVolumeCache,
    private readonly idempotency: IdempotencyProvider
  ) {}

  async handle(
    event:
      | DepositTransactionCompleted
      | TransfertTransactionCompleted
      | WalletToWalletTransactionCompleted
  ) {
    if (event instanceof WalletToWalletTransactionCompleted) {
      const { sender, recipient } = event.payload
      // Le volume est compté par compte, des deux côtés — y compris pour un marchand, dont le
      // compte est l'organisation. La clé s'aligne ainsi sur la lecture des plafonds.
      await Promise.all([
        this.persist(sender.reference, sender.accountId, sender.amount, sender.occurredAt),
        this.persist(recipient.reference, recipient.accountId, recipient.amount, recipient.occurredAt),
      ])
      return
    }

    // Dépôt (consumer OU encaissement marchand `checkout`) : volume du **compte crédité**. L'event
    // porte `accountId` même sans user → l'encaissement marchand n'est plus ignoré.
    if (event instanceof DepositTransactionCompleted) {
      const { reference, accountId, amount } = event.data
      await this.persist(reference, accountId, amount)
      return
    }

    // Transfert/payout sortant : volume du **compte émetteur** (`accountId`). Pour un user
    // `accountId == usersUid` ; pour un **payout** org (sans user) c'est l'org — sinon la clé
    // tomberait sur `usersUid` null et le volume marchand ne monterait jamais.
    const { accountId, amount, reference } = event.data
    await this.persist(reference, accountId, amount)
  }

  /**
   * Marque la référence comme traitée (idempotence) puis incrémente le volume du compte.
   */
  private async persist(
    reference: string,
    accountId: string,
    amount: number,
    timestamp?: Date | string | import('luxon').DateTime
  ): Promise<void> {
    const ok = await this.idempotency.checkAndMark(reference)
    if (!ok) return

    await this.transactionVolumeCache.incrementOnSuccess({ accountId, amount, timestamp })
  }
}
