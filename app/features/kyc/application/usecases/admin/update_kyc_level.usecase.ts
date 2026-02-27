import KycLevelRepository from '#features/kyc/domain/imterfaces/kyc_level_repository'
import { inject } from '@adonisjs/core'
import { KycLevelResponseDto, UpdateKycLevelDto } from '#features/kyc/application/dto/kyc_level.dto'
import KycLevelNotFoundException from '#features/kyc/infrastructure/exceptions/kyc_level_not_found_exception'
import KycLevelAlreadyExistsException from '#features/kyc/infrastructure/exceptions/kyc_level_already_exists_exception'

@inject()
export default class UpdateKycLevelUseCase {
  /**
   * Creates an instance of the class with the specified KycLevelRepository.
   *
   * @param {KycLevelRepository} kycLevelRepository - The repository used to manage KYC levels.
   */
  constructor(private readonly kycLevelRepository: KycLevelRepository) {}

  /**
   * Updates an existing KYC (Know Your Customer) level in the database with the provided information.
   *
   * @param {number} id - The unique identifier of the KYC level to update.
   * @param {UpdateKycLevelDto} data - The data to update the KYC level, including properties such as level, singleLimit, dailyLimit, monthlyLimit, balanceLimit, and isActive.
   * @return {Promise<KycLevelResponseDto>} A promise that resolves to the updated KYC level response DTO.
   * @throws {Exception} Throws an exception if the KYC level is not found or if there is a conflict with an existing level.
   */
  async execute(id: number, data: UpdateKycLevelDto): Promise<KycLevelResponseDto> {
    const kycLevel = await this.kycLevelRepository.findById(id)

    if (!kycLevel) {
      throw new KycLevelNotFoundException()
    }

    if (data.level !== undefined) {
      const existingLevel = await this.kycLevelRepository.findByLevel(data.level)

      if (existingLevel && Number(existingLevel.id) !== Number(id)) {
        throw new KycLevelAlreadyExistsException(data.level)
      }

      kycLevel.level = data.level
    }

    if (data.singleLimit !== undefined) kycLevel.singleLimit = data.singleLimit
    if (data.dailyLimit !== undefined) kycLevel.dailyLimit = data.dailyLimit
    if (data.monthlyLimit !== undefined) kycLevel.monthlyLimit = data.monthlyLimit
    if (data.balanceLimit !== undefined) kycLevel.balanceLimit = data.balanceLimit
    if (data.isActive !== undefined) kycLevel.isActive = data.isActive

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
