import { inject } from '@adonisjs/core'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import LedgerService from '#core/money/ledger/application/services/ledger_service'

/**
 * Réservation de fonds d'un lot de transfert de masse (mass-transfer, B2 / L2-D2, L2-D4).
 *
 * **Option A** : la réservation = **un débit gardé du total** du wallet org (check-solde + réserve en
 * un acte atomique), journalisé par **une** écriture ledger de **hold** écrite **directement** au
 * ledger, **sans transaction** ('transaction_id = null') — sa cause est le lot, pas un paiement. Le
 * débit du wallet n'est ainsi journalisé qu'**une seule fois** ; les items sont ensuite **pré-financés**
 * (ils ne re-débitent pas, B1).
 *
 * Deux libérations distinctes :
 * - **par item** (échec au settlement) : le refund existant sur la transaction **de l'item** (hors de
 *   ce service) ;
 * - **du hold entier** (rejet/annulation d'un lot avant exécution) : `releaseHold` ci-dessous.
 */
@inject()
export default class TransferReservationService {
  constructor(
    private readonly walletService: WalletService,
    private readonly ledgerService: LedgerService
  ) {}

  /**
   * Pose le hold : **débit gardé** du total (lève `InsufficientFundsException` si solde insuffisant,
   * de façon race safe) + écriture ledger de hold transaction less. Renvoie la référence du hold
   * (id de l'écriture ledger) à stocker dans `transfer_batch.reservation_ref'.
   */
  async hold(
    accountId: string,
    amount: number,
    reference?: string,
    trx?: TransactionClientContract,
    fees: number = 0
  ): Promise<{ reservationRef: string }> {
    const wallet = await this.walletService.getByAccountId(accountId, trx)
    const balanceBefore = Number(wallet.balance)

    // `amount` = principal, `fees` = frais : on immobilise la somme, mais la ligne ledger les
    // **ventile** (L2-D36) — en prefunded, c'est le seul endroit où ces frais figurent au journal.
    const debited = await this.walletService.debitBalance(wallet.id, amount + fees, trx)

    const entry = await this.ledgerService.recordHold(
      {
        walletId: wallet.id,
        amount,
        fees,
        balanceBefore,
        balanceAfter: debited.balance,
        reference,
      },
      trx
    )

    return { reservationRef: String(entry.id) }
  }

  /**
   * Libère **tout** le hold (rejet/annulation) : recrédit du total + écriture ledger de libération
   * transaction-less, symétrique du hold.
   */
  async releaseHold(
    accountId: string,
    amount: number,
    reference?: string,
    trx?: TransactionClientContract,
    fees: number = 0
  ): Promise<void> {
    const wallet = await this.walletService.getByAccountId(accountId, trx)
    const balanceBefore = Number(wallet.balance)

    const total = amount + fees
    const credited = await this.walletService.creditBalance(wallet.id, total, trx)

    await this.ledgerService.recordHoldRelease(
      {
        walletId: wallet.id,
        amount,
        fees,
        balanceBefore,
        balanceAfter: credited?.balance ?? balanceBefore + total,
        reference,
      },
      trx
    )
  }
}
