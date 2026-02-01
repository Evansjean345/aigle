import KycLevelRepository from '#features/kyc/domain/imterfaces/kyc_level_repository'
import { inject } from '@adonisjs/core'
import { KycLevelResponseDto } from '#features/kyc/application/dto/kyc_level.dto'

@inject()
export default class GetAllKycLevelsUseCase {
  constructor(private readonly kycLevelRepository: KycLevelRepository) {}

  /**
   * Retrieves all KYC levels from the repository and maps them to response DTOs.
   */
  async execute(): Promise<KycLevelResponseDto[]> {
    const kycLevels = await this.kycLevelRepository.findAll()
    return kycLevels.map((level) => ({
      id: level.id,
      level: level.level,
      singleLimit: level.singleLimit,
      dailyLimit: level.dailyLimit,
      monthlyLimit: level.monthlyLimit,
      balanceLimit: level.balanceLimit,
      isActive: level.isActive,
      createdAt: level.createdAt?.toISO() || '',
      updatedAt: level.updatedAt?.toISO() || '',
    }))
  }
}
