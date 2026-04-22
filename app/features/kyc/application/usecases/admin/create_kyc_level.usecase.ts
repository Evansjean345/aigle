import KycLevelRepository from '#features/kyc/domain/interfaces/kyc_level_repository'
import { inject } from '@adonisjs/core'
import { CreateKycLevelDto, KycLevelResponseDto } from '#features/kyc/application/dto/kyc_level.dto'
import KycLevel from '#features/kyc/domain/models/kyc_level'
import KycLevelAlreadyExistsException from '#features/kyc/infrastructure/exceptions/kyc_level_already_exists_exception'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

export interface AdminAuditContext {
  actorId: string
  actorType?: string
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

@inject()
export default class CreateKycLevelUseCase {
  constructor(private readonly kycLevelRepository: KycLevelRepository) {}

  async execute(
    data: CreateKycLevelDto,
    auditContext?: AdminAuditContext
  ): Promise<KycLevelResponseDto> {
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

    if (auditContext) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'CONFIGURATION',
          eventAction: 'KYC_LEVEL_CREATED',
          actorId: auditContext.actorId,
          actorType: auditContext.actorType ?? 'Admin',
          targetType: 'KycLevel',
          targetId: String(kycLevel.id),
          result: AuditResult.SUCCESS,
          ipAddress: auditContext.ipAddress ?? null,
          userAgent: auditContext.userAgent ?? null,
          requestId: auditContext.requestId ?? null,
          metadata: {
            level: kycLevel.level,
            singleLimit: kycLevel.singleLimit,
            dailyLimit: kycLevel.dailyLimit,
            monthlyLimit: kycLevel.monthlyLimit,
            balanceLimit: kycLevel.balanceLimit,
            isActive: kycLevel.isActive,
          },
        })
        .catch((_) => {})
    }

    return KycLevelResponseDto.fromKycLevel(kycLevel)
  }
}
