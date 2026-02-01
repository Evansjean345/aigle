import KycLevelRepository from '#features/kyc/domain/imterfaces/kyc_level_repository'
import { inject } from '@adonisjs/core'
import { CreateKycLevelDto, KycLevelResponseDto } from '#features/kyc/application/dto/kyc_level.dto'
import KycLevel from '#features/kyc/domain/models/kyc_level'
import KycLevelAlreadyExistsException from '#features/kyc/infrastructure/exceptions/kyc_level_already_exists_exception'

@inject()
export default class CreateKycLevelUseCase {
  constructor(private readonly kycLevelRepository: KycLevelRepository) {}

  async execute(data: CreateKycLevelDto): Promise<KycLevelResponseDto> {
    const existingLevel = await this.kycLevelRepository.findByLevel(data.level)
    if (existingLevel) {
      throw new KycLevelAlreadyExistsException(data.level)
    }

    const kycLevel = new KycLevel()
    kycLevel.level = data.level
    kycLevel.singleLimit = data.singleLimit
    kycLevel.dailyLimit = data.dailyLimit
    kycLevel.monthlyLimit = data.monthlyLimit
    kycLevel.balanceLimit = data.balanceLimit
    if (data.isActive !== undefined) {
      kycLevel.isActive = data.isActive
    }

    await this.kycLevelRepository.save(kycLevel)

    return {
      id: kycLevel.id,
      level: kycLevel.level,
      singleLimit: kycLevel.singleLimit,
      dailyLimit: kycLevel.dailyLimit,
      monthlyLimit: kycLevel.monthlyLimit,
      balanceLimit: kycLevel.balanceLimit,
      isActive: kycLevel.isActive,
      createdAt: kycLevel.createdAt?.toISO() || '',
      updatedAt: kycLevel.updatedAt?.toISO() || '',
    }
  }
}
