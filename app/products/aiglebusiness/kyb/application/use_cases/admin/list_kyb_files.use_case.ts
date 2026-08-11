import { inject } from '@adonisjs/core'
import BusinessReviewService from '#core/identity/kyc/application/services/business_review_service'
import type {
  ListKycDocumentsFilters,
  PaginatedKycDocumentsResult,
} from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/** File de revue des dossiers d'entreprise, pour le back-office. */
@inject()
export default class ListKybFilesUseCase {
  constructor(private readonly reviewService: BusinessReviewService) {}

  /**
   * Rend la page demandée de la file.
   *
   * @param {number} page - Page demandée.
   * @param {number} perPage - Taille de page.
   * @param {ListKycDocumentsFilters} [filters] - Filtres de la revue.
   * @returns {Promise<PaginatedKycDocumentsResult>} La page et ses métadonnées.
   */
  async execute(
    page: number,
    perPage: number,
    filters?: ListKycDocumentsFilters
  ): Promise<PaginatedKycDocumentsResult> {
    return this.reviewService.list(page, perPage, filters)
  }
}
