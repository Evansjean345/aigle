import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import { OrganisationStatsResponseDTO } from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation.dto'

/**
 * Compteurs d'en-tête de la liste des organisations, pour l'espace admin.
 */
@inject()
export default class GetOrganisationStatsForAdminUseCase {
  constructor(private readonly organisations: OrganisationRepository) {}

  /**
   * Exécute la lecture.
   *
   * Les compteurs décrivent le parc entier et ne suivent pas les filtres de la liste.
   *
   * @returns {Promise<OrganisationStatsResponseDTO>} Les six compteurs du bandeau.
   */
  async execute(): Promise<OrganisationStatsResponseDTO> {
    return OrganisationStatsResponseDTO.fromCounts(await this.organisations.countStats())
  }
}
