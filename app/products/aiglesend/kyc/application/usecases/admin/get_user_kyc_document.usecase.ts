import { inject } from '@adonisjs/core'
import IdentityReviewService from '#core/identity/kyc/application/services/identity_review_service'
import { AdminKycListDto } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

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
   * @returns {Promise<AdminKycListDto | null>} Le document, ou `null` s'il n'en a pas soumis.
   */
  async execute(userId: string): Promise<AdminKycListDto | null> {
    const document = await this.kycDocumentService.findByUser(userId)

    return document ? AdminKycListDto.fromResult(document) : null
  }
}
