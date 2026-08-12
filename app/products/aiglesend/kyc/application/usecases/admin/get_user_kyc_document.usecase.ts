import { inject } from '@adonisjs/core'
import IdentityReviewService from '#core/identity/kyc/application/services/identity_review_service'
import { AdminKycDetailDto } from '#aiglesend/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Charge le document KYC courant d'un utilisateur.
 */
@inject()
export default class GetUserKycDocumentUseCase {
  constructor(private readonly kycDocumentService: IdentityReviewService) {}

  /**
   * Exécute la lecture.
   *
   * @param {string} userId - Identifiant public de l'utilisateur.
   * @returns {Promise<AdminKycDetailDto | null>} Le document, ou `null` s'il n'en a pas soumis.
   */
  async execute(userId: string): Promise<AdminKycDetailDto | null> {
    const document = await this.kycDocumentService.findByAccountId(userId)

    return document ? AdminKycDetailDto.fromResult(document) : null
  }
}
