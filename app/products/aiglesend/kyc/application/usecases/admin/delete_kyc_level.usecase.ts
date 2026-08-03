import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import KycLevelService from '#core/identity/kyc/application/services/kyc_level_service'
import { AuditResult } from '#core/audit/domain/enums'
import type { AdminAuditContext } from '#aiglesend/kyc/application/usecases/admin/create_kyc_level.usecase'

/**
 * Supprime un niveau KYC depuis le back-office.
 */
@inject()
export default class DeleteKycLevelUseCase {
  constructor(private readonly kycLevelService: KycLevelService) {}

  /**
   * Exécute la suppression.
   *
   * @param {number} id - Niveau visé.
   * @param {AdminAuditContext} [auditContext] - Auteur et contexte de la requête.
   * @throws {KycLevelNotFoundException} Niveau inconnu.
   * @throws {Exception} Des comptes utilisent encore ce niveau.
   */
  async execute(id: number, auditContext?: AdminAuditContext): Promise<void> {
    const snapshot = await this.kycLevelService.delete(id)

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
          metadata: { ...snapshot },
        })
        .catch(() => {})
    }
  }
}
