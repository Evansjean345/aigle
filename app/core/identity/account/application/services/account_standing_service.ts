import { inject } from '@adonisjs/core'
import AccountRepository from '#core/identity/account/domain/interfaces/account_repository'
import KycLevelDirectoryService from '#core/identity/kyc/application/services/kyc_level_directory_service'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { type AccountStatus } from '#core/identity/account/domain/enums/account_status'
import {
  type AccountDescriptionResult,
  type AccountStandingResult,
} from '#core/identity/account/application/dtos/account.dto'
import AccountNotFoundException from '#core/identity/account/domain/exceptions/account_not_found_exception'
import AccountLimitsNotConfiguredException from '#core/identity/account/domain/exceptions/account_limits_not_configured_exception'

/**
 * Lecture du standing d'un compte, consommée par la validation money.
 *
 * Le compte est la source unique en lecture : segment, niveau et statut y sont synchronisés depuis
 * le propriétaire, et aucune branche par `ownerType` n'est nécessaire. Les limites sont résolues
 * via le service `kyc`, jamais son repository.
 *
 * Renvoie un Result minimal : jamais le modèle `Account`, ni `User` / `Organisation`.
 */
@inject()
export default class AccountStandingService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly kycLevelDirectory: KycLevelDirectoryService
  ) {}

  /**
   * Lit le seul statut d'un compte, sans résoudre ses limites.
   *
   * Destinée aux gardes qui n'ont pas à connaître les plafonds : elles restent ainsi insensibles à
   * la configuration du catalogue de niveaux.
   *
   * @param {string} accountId - Compte cible.
   * @returns {Promise<AccountStatus>} Le statut du compte.
   * @throws {AccountNotFoundException} Compte introuvable.
   */
  async getStatus(accountId: string): Promise<AccountStatus> {
    const account = await this.accountRepository.findByAccountId(accountId)

    if (!account) {
      throw new AccountNotFoundException()
    }

    return account.status
  }

  /**
   * Décrit un compte sans résoudre ses limites.
   *
   * @param {string} accountId - Compte cible.
   * @returns {Promise<AccountDescriptionResult | null>} La description, ou `null` si le compte
   *   n'existe pas.
   */
  async describe(accountId: string): Promise<AccountDescriptionResult | null> {
    const account = await this.accountRepository.findByAccountId(accountId)

    if (!account) return null

    return {
      accountId: account.accountId,
      ownerType: account.ownerType,
      segment: (account.segment ?? AccountSegment.PARTICULIER) as AccountSegment,
      status: account.status,
    }
  }

  /**
   * Résout le standing d'un compte : segment, niveau, statut et limites.
   *
   * Un plafond `null` signifie illimité.
   *
   * @param {string} accountId - Compte cible.
   * @returns {Promise<AccountStandingResult>} Le standing résolu.
   * @throws {AccountNotFoundException} Compte introuvable.
   * @throws {AccountLimitsNotConfiguredException} La grille `(segment, level)` est absente du
   *   catalogue de niveaux.
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
