import { inject } from '@adonisjs/core'
import BusinessReviewService from '#core/identity/kyc/application/services/business_review_service'
import OrganisationRepository from '#aiglebusiness/organisation/domain/interfaces/organisation_repository'
import {
  AdminKybListItemDto,
  type AdminKybPageDto,
} from '#aiglebusiness/kyb/application/dtos/admin/admin_kyb_review.dto'
import type { ListKycDocumentsFilters } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * File de revue des dossiers d'entreprise, pour le back-office.
 *
 * Compose deux lectures : le core rend les dossiers, le produit les nomme. Les organisations sont
 * chargées en un seul appel pour toute la page — un dossier par requête ferait un N+1.
 */
@inject()
export default class ListKybFilesUseCase {
  constructor(
    private readonly reviewService: BusinessReviewService,
    private readonly organisations: OrganisationRepository
  ) {}

  /**
   * Rend la page demandée de la file, chaque dossier accompagné de son entreprise.
   *
   * @param {number} page - Page demandée.
   * @param {number} perPage - Taille de page.
   * @param {ListKycDocumentsFilters} [filters] - Filtres de la revue.
   * @returns {Promise<AdminKybPageDto>} La page et ses métadonnées.
   */
  async execute(
    page: number,
    perPage: number,
    filters?: ListKycDocumentsFilters
  ): Promise<AdminKybPageDto> {
    const paginated = await this.reviewService.list(page, perPage, filters)

    const accountIds = [...new Set(paginated.data.map((document) => document.accountId))]
    const found = accountIds.length ? await this.organisations.listByIds(accountIds) : []
    const byId = new Map(found.map((organisation) => [organisation.organisationId, organisation]))

    return {
      data: paginated.data.map((document) =>
        AdminKybListItemDto.fromDocument(document, byId.get(document.accountId))
      ),
      meta: paginated.meta,
    }
  }
}
