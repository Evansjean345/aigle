import { inject } from '@adonisjs/core'
import IdentityReviewService from '#core/identity/kyc/application/services/identity_review_service'
import { KycStatsDto } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Compteurs de la revue KYC.
 */
@inject()
export default class GetKycStatsUseCase {
  constructor(private readonly kycDocumentService: IdentityReviewService) {}

  /**
   * Exécute la lecture.
   *
   * @returns {Promise<KycStatsDto>} Les compteurs par statut.
   */
  async execute(): Promise<KycStatsDto> {
    return this.kycDocumentService.getStats()
  }
}
