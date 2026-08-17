import { MobileTransactionResponseDTO } from '#core/money/transactions/application/dto/mobile_transaction.dto'
import type Transaction from '#core/money/transactions/domain/models/transaction'
import type { AccountActivityResult } from '#core/money/ledger/application/dtos/ledger.dto'
import type { DailyAccountActivity } from '#core/money/ledger/domain/types/daily_account_activity'

// ── Response (output HTTP) ──────────────────────────────────────────

/**
 * Activité d'un compte telle que son tableau de bord l'affiche : ce qui est sorti, ce qui est
 * entré, et les derniers mouvements.
 */
export class AccountActivitySummaryResponseDTO {
  declare payoutTotal: number
  declare withdrawalTotal: number
  declare recentTransactions: MobileTransactionResponseDTO[]

  /**
   * Compose le résumé à partir des agrégats du grand livre et des dernières transactions.
   *
   * @param {AccountActivityResult} activity - Agrégats du compte.
   * @param {Transaction[]} recent - Dernières transactions, de la plus récente à la plus ancienne.
   * @returns {AccountActivitySummaryResponseDTO} Le résumé.
   */
  static from(
    activity: AccountActivityResult,
    recent: Transaction[]
  ): AccountActivitySummaryResponseDTO {
    const dto = new AccountActivitySummaryResponseDTO()

    dto.payoutTotal = activity.totalOut
    dto.withdrawalTotal = activity.totalIn
    dto.recentTransactions = recent.map(MobileTransactionResponseDTO.fromTransaction)

    return dto
  }
}

/** Un jour de la courbe d'activité : ce qui est sorti, ce qui est entré. */
export class AccountActivityPointResponseDTO {
  declare date: string
  declare payout: number
  declare withdrawal: number

  /**
   * Projette les jours mouvementés en points de courbe.
   *
   * @param {DailyAccountActivity[]} days - Jours porteurs d'au moins une écriture.
   * @returns {AccountActivityPointResponseDTO[]} La courbe, du plus ancien au plus récent.
   */
  static fromDays(days: DailyAccountActivity[]): AccountActivityPointResponseDTO[] {
    return days.map((day) => {
      const point = new AccountActivityPointResponseDTO()

      point.date = day.date
      point.payout = day.totalOut
      point.withdrawal = day.totalIn

      return point
    })
  }
}
