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
      const { senderTransaction: sTx, receiverTransaction: rTx } = event
      // Volume PAR COMPTE (account-centric) : émetteur ET bénéficiaire — y compris un **marchand**
      // (compte org sans user). `Transaction.accountId` == usersUid pour un user, l'org pour un
      // marchand : la clé de volume s'aligne ainsi sur la lecture (validation/quotas par accountId).
      await Promise.all([
        this.persist(sTx.reference, sTx.accountId, sTx.amount, sTx.createdAt),
        this.persist(rTx.reference, rTx.accountId, rTx.amount, rTx.createdAt),
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

    // Transfert consumer sortant : l'émetteur est un user (accountId == userId).
    const { userId, amount, reference } = event.data
    await this.persist(reference, userId, amount)
  }

  /**
   * Marque la référence comme traitée (idempotence) puis incrémente le volume **du compte**.
   * `accountId` est la clé de volume (opaque côté cache) : elle vaut `usersUid` pour un user et
   * l'org pour un marchand.
   */
  private async persist(
    reference: string,
    accountId: string,
    amount: number,
    timestamp?: Date | string | import('luxon').DateTime
  ): Promise<void> {
    const ok = await this.idempotency.checkAndMark(reference)
    if (!ok) return

    await this.transactionVolumeCache.incrementOnSuccess({ userId: accountId, amount, timestamp })
  }
}
