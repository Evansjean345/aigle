import { inject } from '@adonisjs/core'
import IdentityReviewService from '#core/identity/kyc/application/services/identity_review_service'
import { AdminKycListDto } from '#aiglesend/kyc/application/dtos/admin/admin_kyc_document.dto'
import type { ListKycDocumentsFilters } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Liste les documents KYC soumis, pour la revue.
 */
@inject()
export default class GetAllKycDocumentsUseCase {
  constructor(private readonly kycDocumentService: IdentityReviewService) {}

  /**
   * Exécute la lecture.
   *
   * @param {number} page - Page demandée.
   * @param {number} perPage - Taille de page.
   * @param {ListKycDocumentsFilters} [filters] - Filtres de la revue.
   * @returns {Promise<{ meta: Record<string, unknown>; data: AdminKycListDto[] }>} La page demandée.
   */
  async execute(
    page: number,
    perPage: number,
    filters?: ListKycDocumentsFilters
  ): Promise<{ meta: Record<string, unknown>; data: AdminKycListDto[] }> {
    const paginated = await this.kycDocumentService.list(page, perPage, filters)

    return {
      meta: paginated.meta,
      data: paginated.data.map(AdminKycListDto.fromResult),
    }
  }
}
