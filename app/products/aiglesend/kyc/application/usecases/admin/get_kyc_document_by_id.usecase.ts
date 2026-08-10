import { inject } from '@adonisjs/core'
import IdentityReviewService from '#core/identity/kyc/application/services/identity_review_service'
import { AdminKycListDto } from '#aiglesend/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Charge un document KYC par son identifiant.
 */
@inject()
export default class GetKycDocumentByIdUseCase {
  constructor(private readonly kycDocumentService: IdentityReviewService) {}

  /**
   * Exécute la lecture.
   *
   * @param {number} id - Identifiant du document.
   * @returns {Promise<AdminKycListDto | null>} Le document, ou `null` s'il n'existe pas.
   */
  async execute(id: number): Promise<AdminKycListDto | null> {
    const document = await this.kycDocumentService.findById(id)

    return document ? AdminKycListDto.fromResult(document) : null
  }
}
