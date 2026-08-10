import { inject } from '@adonisjs/core'
import KycLevelService from '#core/identity/kyc/application/services/kyc_level_service'
import { KycLevelResponseDto } from '#aiglesend/kyc/application/dtos/admin/admin_kyc_level.dto'

/**
 * Liste les niveaux KYC configurés.
 */
@inject()
export default class GetAllKycLevelsUseCase {
  constructor(private readonly kycLevelService: KycLevelService) {}

  /**
   * Exécute la lecture.
   *
   * @returns {Promise<KycLevelResponseDto[]>} Les niveaux et leurs plafonds.
   */
  async execute(): Promise<KycLevelResponseDto[]> {
    const levels = await this.kycLevelService.list()

    return levels.map(KycLevelResponseDto.fromResult)
  }
}
