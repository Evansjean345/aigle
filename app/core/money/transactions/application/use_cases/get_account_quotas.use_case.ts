import { inject } from '@adonisjs/core'
import AccountStandingService from '#core/identity/account/application/services/account_standing_service'
import TransactionVolumeCache from '#core/money/transactions/domain/interfaces/transaction_volume_cache'
import WalletRepository from '#core/money/wallet/domain/interfaces/wallet_repository'
import { type AccountQuotasResult } from '#core/money/transactions/application/dtos/account_quotas_result'

/**
 * Résout les **quotas** d'un compte (account-centric) : plafonds (issus du standing), consommation
 * quotidienne/mensuelle (cache de volumes, clé `accountId`) et solde courant du wallet.
 *
 * Pendant business de `GetTransactionQuotasUseCase` (aiglesend, user-centric) : ne lit ni `User`,
 * ni `user.keyLevel` — le compte est la **source unique en lecture** via `getStanding`. Les plafonds
 * `null` (illimité) sont propagés tels quels et `remaining` vaut alors `null`.
 */
@inject()
export default class GetAccountQuotasUseCase {
  constructor(
    private readonly accountStanding: AccountStandingService,
    private readonly transactionVolumeCache: TransactionVolumeCache,
    private readonly walletRepository: WalletRepository
  ) {}

  /**
   * @param accountId Compte cible (pour une organisation, `accountId == organisationId`).
   * @throws {AccountNotFoundException} 404 si le compte est introuvable.
   * @throws {AccountLimitsNotConfiguredException} 500 si la grille `(segment, level)` est absente.
   */
  async execute(accountId: string): Promise<AccountQuotasResult> {
    const { limits, segment, level } = await this.accountStanding.getStanding(accountId)

    const [dailyConsumed, monthlyConsumed, wallet] = await Promise.all([
      this.transactionVolumeCache.getDailyVolume(accountId),
      this.transactionVolumeCache.getMonthlyVolume(accountId),
      this.walletRepository.findByAccountId(accountId),
    ])

    const currentBalance = wallet ? Number(wallet.balance) : 0

    return {
      daily: {
        consumed: dailyConsumed,
        limit: limits.daily,
        remaining: this.remaining(limits.daily, dailyConsumed),
      },
      monthly: {
        consumed: monthlyConsumed,
        limit: limits.monthly,
        remaining: this.remaining(limits.monthly, monthlyConsumed),
      },
      wallet: {
        currentBalance,
        limit: limits.balance,
        remainingCapacity: this.remaining(limits.balance, currentBalance),
      },
      singleTransaction: {
        limit: limits.single,
      },
      segment,
      level,
    }
  }

  /** Capacité restante bornée à 0 ; `null` (illimité) est propagé. */
  private remaining(limit: number | null, consumed: number): number | null {
    if (limit === null) return null
    return Math.max(0, limit - consumed)
  }
}
