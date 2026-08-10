import { inject } from '@adonisjs/core'
import emitter from '@adonisjs/core/services/emitter'
import KycLevelService from '#core/identity/kyc/application/services/kyc_level_service'
import { AuditResult } from '#core/audit/domain/enums'
import {
  KycLevelResponseDto,
  UpdateKycLevelDto,
} from '#core/identity/kyc/application/dtos/admin/admin_kyc_level.dto'
import type { AdminAuditContext } from '#aiglesend/kyc/application/usecases/admin/create_kyc_level.usecase'

/**
 * Met à jour un niveau KYC depuis le back-office.
 */
@inject()
export default class UpdateKycLevelUseCase {
  constructor(private readonly kycLevelService: KycLevelService) {}

  /**
   * Exécute la mise à jour.
   *
   * @param {number} id - Niveau visé.
   * @param {UpdateKycLevelDto} data - Champs à modifier.
   * @param {AdminAuditContext} [auditContext] - Auteur et contexte de la requête.
   * @returns {Promise<KycLevelResponseDto>} Le niveau mis à jour.
   * @throws {KycLevelNotFoundException} Niveau inconnu.
   * @throws {KycLevelAlreadyExistsException} Le rang demandé est déjà pris.
   */
  async execute(
    id: number,
    data: UpdateKycLevelDto,
    auditContext?: AdminAuditContext
  ): Promise<KycLevelResponseDto> {
    const { before, after } = await this.kycLevelService.update(id, data)

    if (auditContext) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'CONFIGURATION',
          eventAction: 'KYC_LEVEL_UPDATED',
          actorId: auditContext.actorId,
          actorType: auditContext.actorType ?? 'Admin',
          targetType: 'KycLevel',
          targetId: String(after.id),
          result: AuditResult.SUCCESS,
          ipAddress: auditContext.ipAddress ?? null,
          userAgent: auditContext.userAgent ?? null,
          requestId: auditContext.requestId ?? null,
          metadata: { before, after },
        })
        .catch(() => {})
    }

    return KycLevelResponseDto.fromResult(after)
  }
}
