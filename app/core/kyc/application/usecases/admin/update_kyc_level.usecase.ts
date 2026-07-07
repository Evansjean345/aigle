import KycLevelRepository from '#core/kyc/domain/interfaces/kyc_level_repository'
import { inject } from '@adonisjs/core'
import { KycLevelResponseDto, UpdateKycLevelDto } from '#core/kyc/application/dto/kyc_level.dto'
import KycLevelNotFoundException from '#core/kyc/domain/exceptions/kyc_level_not_found_exception'
import KycLevelAlreadyExistsException from '#core/kyc/domain/exceptions/kyc_level_already_exists_exception'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import type { AdminAuditContext } from '#core/kyc/application/usecases/admin/create_kyc_level.usecase'

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
  async execute(
    id: number,
    data: UpdateKycLevelDto,
    auditContext?: AdminAuditContext
  ): Promise<KycLevelResponseDto> {
    const kycLevel = await this.kycLevelRepository.findById(id)

    if (!kycLevel) {
      throw new KycLevelNotFoundException()
    }

    const before = {
      level: kycLevel.level,
      singleLimit: kycLevel.singleLimit,
      dailyLimit: kycLevel.dailyLimit,
      monthlyLimit: kycLevel.monthlyLimit,
      balanceLimit: kycLevel.balanceLimit,
      isActive: kycLevel.isActive,
      isArchive: kycLevel.isArchived,
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
    if (data.isArchived !== undefined) kycLevel.isArchived = data.isArchived

    await this.kycLevelRepository.save(kycLevel)

    if (auditContext) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'CONFIGURATION',
          eventAction: 'KYC_LEVEL_UPDATED',
          actorId: auditContext.actorId,
          actorType: auditContext.actorType ?? 'Admin',
          targetType: 'KycLevel',
          targetId: String(kycLevel.id),
          result: AuditResult.SUCCESS,
          ipAddress: auditContext.ipAddress ?? null,
          userAgent: auditContext.userAgent ?? null,
          requestId: auditContext.requestId ?? null,
          metadata: {
            before,
            after: {
              level: kycLevel.level,
              singleLimit: kycLevel.singleLimit,
              dailyLimit: kycLevel.dailyLimit,
              monthlyLimit: kycLevel.monthlyLimit,
              balanceLimit: kycLevel.balanceLimit,
              isActive: kycLevel.isActive,
            },
          },
        })
        .catch((_) => {})
    }

    return KycLevelResponseDto.fromKycLevel(kycLevel)
  }
}
