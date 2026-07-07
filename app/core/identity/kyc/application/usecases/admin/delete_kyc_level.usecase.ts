import KycLevelRepository from '#core/identity/kyc/domain/interfaces/kyc_level_repository'
import { inject } from '@adonisjs/core'
import KycLevelNotFoundException from '#core/identity/kyc/domain/exceptions/kyc_level_not_found_exception'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import type { AdminAuditContext } from '#core/identity/kyc/application/usecases/admin/create_kyc_level.usecase'
import User from '#core/identity/user/domain/models/user'
import { Exception } from '@adonisjs/core/exceptions'

@inject()
export default class DeleteKycLevelUseCase {
  constructor(private readonly kycLevelRepository: KycLevelRepository) {}

  async execute(id: number, auditContext?: AdminAuditContext): Promise<void> {
    const kycLevel = await this.kycLevelRepository.findById(id)
    if (!kycLevel) {
      throw new KycLevelNotFoundException()
    }

    const usersCount = await User.query()
      .where('kyc_level', kycLevel.level)
      .count('* as total')
      .first()

    const total = Number(usersCount?.$extras?.total ?? 0)

    if (total > 0) {
      throw new Exception(
        `Impossible de supprimer ce niveau KYC : ${total} compte(s) utilisateur(s) y sont liés.`,
        {
          status: 409,
          code: 'E_KYC_LEVEL_IN_USE',
        }
      )
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
