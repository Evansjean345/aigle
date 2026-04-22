import KycLevelRepository from '#features/kyc/domain/interfaces/kyc_level_repository'
import { inject } from '@adonisjs/core'
import KycLevelNotFoundException from '#features/kyc/infrastructure/exceptions/kyc_level_not_found_exception'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'
import type { AdminAuditContext } from '#features/kyc/application/usecases/admin/create_kyc_level.usecase'

@inject()
export default class DeleteKycLevelUseCase {
  constructor(private readonly kycLevelRepository: KycLevelRepository) {}

  async execute(id: number, auditContext?: AdminAuditContext): Promise<void> {
    const kycLevel = await this.kycLevelRepository.findById(id)
    if (!kycLevel) {
      throw new KycLevelNotFoundException()
    }

    const snapshot = {
      id: kycLevel.id,
      level: kycLevel.level,
      singleLimit: kycLevel.singleLimit,
      dailyLimit: kycLevel.dailyLimit,
      monthlyLimit: kycLevel.monthlyLimit,
      balanceLimit: kycLevel.balanceLimit,
      isActive: kycLevel.isActive,
    }

    await this.kycLevelRepository.delete(kycLevel)

    if (auditContext) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'CONFIGURATION',
          eventAction: 'KYC_LEVEL_DELETED',
          actorId: auditContext.actorId,
          actorType: auditContext.actorType ?? 'Admin',
          targetType: 'KycLevel',
          targetId: String(snapshot.id),
          result: AuditResult.SUCCESS,
          ipAddress: auditContext.ipAddress ?? null,
          userAgent: auditContext.userAgent ?? null,
          requestId: auditContext.requestId ?? null,
          metadata: snapshot,
        })
        .catch((_) => {})
    }
  }
}
