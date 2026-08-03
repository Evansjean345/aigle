import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import KycLevelService from '#core/identity/kyc/application/services/kyc_level_service'
import { AuditResult } from '#core/audit/domain/enums'
import {
  CreateKycLevelDto,
  KycLevelResponseDto,
} from '#core/identity/kyc/application/dto/kyc_level.dto'

export interface AdminAuditContext {
  actorId: string
  actorType?: string
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
}

/**
 * Crée un niveau KYC depuis le back-office.
 */
@inject()
export default class CreateKycLevelUseCase {
  constructor(private readonly kycLevelService: KycLevelService) {}

  /**
   * Exécute la création.
   *
   * @param {CreateKycLevelDto} data - Niveau et plafonds.
   * @param {AdminAuditContext} [auditContext] - Auteur et contexte de la requête.
   * @returns {Promise<KycLevelResponseDto>} Le niveau créé.
   * @throws {KycLevelAlreadyExistsException} Un niveau porte déjà ce rang.
   */
  async execute(
    data: CreateKycLevelDto,
    auditContext?: AdminAuditContext
  ): Promise<KycLevelResponseDto> {
    const kycLevel = await this.kycLevelService.create(data)

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
        .catch(() => {})
    }

    return KycLevelResponseDto.fromResult(kycLevel)
  }
}
