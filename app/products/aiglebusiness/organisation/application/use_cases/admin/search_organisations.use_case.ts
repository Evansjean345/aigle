import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationSearchItemResponseDTO } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_listing.dto'

/** Plafond de résultats : l'appelant est un champ d'autocomplétion, pas un export. */
const SEARCH_LIMIT = 10

/**
 * Recherche des organisations par nom ou code payable, pour un champ d'autocomplétion.
 */
@inject()
export default class SearchOrganisationsForAdminUseCase {
  constructor(private readonly organisations: OrganisationRepository) {}

  /**
   * Exécute la recherche.
   *
   * @param {string} term - Fragment saisi par l'utilisateur.
   * @returns {Promise<OrganisationSearchItemResponseDTO[]>} Les correspondances, `[]` si le terme est
   * vide.
   */
  async execute(term: string): Promise<OrganisationSearchItemResponseDTO[]> {
    const organisations = await this.organisations.searchByTerm(term, SEARCH_LIMIT)

    return organisations.map((organisation) =>
      OrganisationSearchItemResponseDTO.fromOrganisation(organisation)
    )
  }
}
