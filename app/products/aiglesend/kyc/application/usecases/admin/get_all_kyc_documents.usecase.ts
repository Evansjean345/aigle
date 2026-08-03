import { inject } from '@adonisjs/core'
import KycDocumentAdminService from '#core/identity/kyc/application/services/kyc_document_admin_service'
import { AdminKycListDto } from '#core/identity/kyc/application/dto/kyc.dto'
import type { ListKycDocumentsFilters } from '#core/identity/kyc/application/dtos/kyc_document_admin.dto'

/**
 * Liste les documents KYC soumis, pour la revue.
 */
@inject()
export default class GetAllKycDocumentsUseCase {
  constructor(private readonly kycDocumentService: KycDocumentAdminService) {}

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
