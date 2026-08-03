import { inject } from '@adonisjs/core'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import LedgerService from '#core/money/ledger/application/services/ledger_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import { OrganisationWalletStatsResponseDTO } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_detail.dto'

/**
 * Portefeuille d'une organisation et son activité comptable, pour l'espace admin.
 */
@inject()
export default class GetOrganisationWalletStatsForAdminUseCase {
  constructor(
    private readonly organisations: OrganisationRepository,
    private readonly wallets: WalletService,
    private readonly ledger: LedgerService
  ) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} organisationId - Identifiant public de l'organisation.
   * @returns {Promise<OrganisationWalletStatsResponseDTO>} Solde et agrégats du grand livre.
   * @throws {OrganisationNotFoundException} Identifiant inconnu.
   */
  async execute(organisationId: string): Promise<OrganisationWalletStatsResponseDTO> {
    const organisation = await this.organisations.findByOrganisationId(organisationId)
    if (!organisation) throw new OrganisationNotFoundException()

    const [balances, activity] = await Promise.all([
      this.wallets.getBalancesByAccountIds([organisationId]),
      this.ledger.getAccountActivity(organisationId),
    ])

    return OrganisationWalletStatsResponseDTO.from(balances.get(organisationId), activity)
  }
}
