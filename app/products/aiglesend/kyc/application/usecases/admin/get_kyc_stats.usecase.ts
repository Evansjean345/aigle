import { inject } from '@adonisjs/core'
import KycDocumentAdminService from '#core/identity/kyc/application/services/kyc_document_admin_service'
import { KycStatsDto } from '#core/identity/kyc/application/dto/kyc.dto'

/**
 * Compteurs de la revue KYC.
 */
@inject()
export default class GetKycStatsUseCase {
  constructor(private readonly kycDocumentService: KycDocumentAdminService) {}

  /**
   * Exécute la lecture.
   *
   * @returns {Promise<KycStatsDto>} Les compteurs par statut.
   */
  async execute(): Promise<KycStatsDto> {
    return this.kycDocumentService.getStats()
  }
}
