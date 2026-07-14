import { inject } from '@adonisjs/core'
import AccountRepository from '#core/identity/account/domain/interfaces/account_repository'
import KycLevelDirectoryService from '#core/identity/kyc/application/services/kyc_level_directory_service'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { type AccountStandingResult } from '#core/identity/account/application/dtos/account.dto'
import AccountNotFoundException from '#core/identity/account/domain/exceptions/account_not_found_exception'
import AccountLimitsNotConfiguredException from '#core/identity/account/domain/exceptions/account_limits_not_configured_exception'

/**
 * Port de LECTURE du **standing** d'un compte (identity), consommé par la validation money.
 *
 * Le compte est la **source unique en lecture** (refactor account-centric β) : `getStanding` lit le
 * compte (segment, niveau, statut — tous synchronisés par push depuis le propriétaire) puis résout
 * ses **limites** via le catalogue de niveaux — consommé par le **service** `kyc`
 * (`KycLevelDirectoryService`), jamais son repository (frontière feature→feature par service).
 * **Aucune** branche par ownerType : la synchro a déjà rapatrié l'état sur le compte.
 *
 * Renvoie un **Result minimal** (`AccountStandingResult`) : jamais le modèle `Account`, ni
 * `User`/`Organisation`.
 */
@inject()
export default class AccountStandingService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly kycLevelDirectory: KycLevelDirectoryService
  ) {}

  /**
   * Résout le standing d'un compte : `{ segment, level, status, limits }`. Les plafonds `null`
   * signifient **illimité**.
   *
   * @param accountId Compte cible.
   * @throws {AccountNotFoundException} 404 si le compte est introuvable.
   * @throws {AccountLimitsNotConfiguredException} 500 si la grille `(segment, level)` est absente
   *   (mauvaise configuration du catalogue de niveaux).
   */
  async getStanding(accountId: string): Promise<AccountStandingResult> {
    const account = await this.accountRepository.findByAccountId(accountId)

    if (!account) {
      throw new AccountNotFoundException()
    }

    const segment = (account.segment ?? AccountSegment.PARTICULIER) as AccountSegment
    const level = account.level ?? 0

    const limits = await this.kycLevelDirectory.getLimits(segment, level)

    if (!limits) {
      throw new AccountLimitsNotConfiguredException(
        `Les limites du compte ne sont pas configurées (segment=${segment}, niveau=${level}).`
      )
    }

    return {
      accountId: account.accountId,
      segment,
      level,
      status: account.status,
      limits,
    }
  }
}
