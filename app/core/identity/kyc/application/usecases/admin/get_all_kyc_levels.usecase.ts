import KycLevelRepository from '#core/identity/kyc/domain/interfaces/kyc_level_repository'
import { inject } from '@adonisjs/core'
import { KycLevelResponseDto } from '#core/identity/kyc/application/dto/kyc_level.dto'

@inject()
export default class GetAllKycLevelsUseCase {
  constructor(private readonly kycLevelRepository: KycLevelRepository) {}

  /**
   * Retrieves all KYC levels from the repository and maps them to response DTOs.
   */
  async execute(): Promise<KycLevelResponseDto[]> {
    const kycLevels = await this.kycLevelRepository.findAll()
    return kycLevels.map(KycLevelResponseDto.fromKycLevel)
  }
}
