import { inject } from '@adonisjs/core'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import OrganisationEnrichmentService from '#aiglebusiness/organisation/application/services/organisation_enrichment_service'
import {
  OrganisationAdminResponseDTO,
  type ListOrganisationsRequestDto,
  type PaginatedOrganisationsResponseDTO,
} from '#aiglebusiness/organisation/application/dtos/admin/admin_organisation.dto'

/** Nombre de lignes par défaut et plafond, pour qu'un `perPage` extravagant ne balaie pas la table. */
const DEFAULT_PER_PAGE = 10
const MAX_PER_PAGE = 100

/**
 * Liste les organisations pour l'espace admin, toutes organisations confondues.
 */
@inject()
export default class ListOrganisationsForAdminUseCase {
  constructor(
    private readonly organisations: OrganisationRepository,
    private readonly enrichment: OrganisationEnrichmentService
  ) {}

  /**
   * Exécute le listage.
   *
   * @param {ListOrganisationsRequestDto} request - Filtres et pagination issus de la requête.
   * @returns {Promise<PaginatedOrganisationsResponseDTO>} La page demandée, propriétaires et
   * portefeuilles résolus.
   */
  async execute(request: ListOrganisationsRequestDto): Promise<PaginatedOrganisationsResponseDTO> {
    const page = await this.organisations.listPaginated({
      page: request.page ?? 1,
      perPage: Math.min(request.perPage ?? DEFAULT_PER_PAGE, MAX_PER_PAGE),
      search: request.search,
      accountType: request.accountType,
      level: request.level,
      status: request.status,
      startDate: request.startDate,
      endDate: request.endDate,
    })

    const enrichment = await this.enrichment.resolve(page.all())

    return OrganisationAdminResponseDTO.fromPaginator(page, enrichment)
  }
}
