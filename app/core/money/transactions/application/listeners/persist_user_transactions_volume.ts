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
      await Promise.all([
        this.persist(sTx.reference, sTx.usersUid, sTx.amount, sTx.createdAt),
        this.persist(rTx.reference, rTx.usersUid, rTx.amount, rTx.createdAt),
      ])
      return
    }

    // Volume PAR USER : un encaissement marchand (checkout) n'a pas de user → ignoré.
    if (event instanceof DepositTransactionCompleted && event.data.type === 'checkout') return

    const { userId, amount, reference } = event.data
    await this.persist(reference, userId!, amount)
  }

  /**
   * Marque la référence comme traitée (idempotence) puis incrémente le volume.
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
}
