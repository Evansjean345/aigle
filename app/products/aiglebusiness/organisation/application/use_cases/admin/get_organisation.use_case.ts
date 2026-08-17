import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationEnrichmentService from '#aiglebusiness/organisation/application/services/organisation_enrichment_service'
import OrganisationNotFoundException from '#aiglebusiness/organisation/domain/exceptions/organisation_not_found_exception'
import { OrganisationAdminResponseDTO } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation_profile.dto'

/**
 * Charge une organisation pour l'espace admin, sans restriction de propriétaire.
 */
@inject()
export default class GetOrganisationForAdminUseCase {
  constructor(
    private readonly organisations: OrganisationRepository,
    private readonly enrichment: OrganisationEnrichmentService
  ) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} organisationId - Identifiant public de l'organisation.
   * @returns {Promise<OrganisationAdminResponseDTO>} La fiche, propriétaire et portefeuille résolus.
   * @throws {OrganisationNotFoundException} Identifiant inconnu.
   */
  async execute(organisationId: string): Promise<OrganisationAdminResponseDTO> {
    const organisation = await this.organisations.findByOrganisationId(organisationId)

    if (!organisation) throw new OrganisationNotFoundException()

    const enrichment = await this.enrichment.resolve([organisation])

    return OrganisationAdminResponseDTO.fromOrganisation(organisation, enrichment)
  }
}
