import { inject } from '@adonisjs/core'
import KycDocumentAdminService from '#core/identity/kyc/application/services/kyc_document_admin_service'
import { AdminKycListDto } from '#core/identity/kyc/application/dto/kyc.dto'

/**
 * Charge un document KYC par son identifiant.
 */
@inject()
export default class GetKycDocumentByIdUseCase {
  constructor(private readonly kycDocumentService: KycDocumentAdminService) {}

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
