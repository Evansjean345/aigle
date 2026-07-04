import { inject } from '@adonisjs/core'
import AuditLogRepository from '#core/audit/domain/interfaces/audit_log_repository'
import Admin from '#core/team/domain/models/admin'
import { AuditLogDetailsResponseDTO } from '#core/audit/application/dtos/admin/admin_audit_details.dto'

@inject()
export default class GetAuditLogDetailsUseCase {
  /**
   * Creates a new instance.
   * @param {AuditLogRepository} auditLogRepository The audit log repository.
   */
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  /**
   * Retrieves a single audit log by id and enriches the admin actor when applicable.
   * @param {string} id - The audit log UUID.
   * @return {Promise<AuditLogDetailsResponseDTO | null>} The details DTO or null.
   */
  async execute(id: string): Promise<AuditLogDetailsResponseDTO | null> {
    const log = await this.auditLogRepository.findById(id)
    if (!log) return null

    let actor: AuditLogDetailsResponseDTO['actor'] = null

    if (log.actorType === 'admin' && log.actorId !== null) {
      const actorId = Number(log.actorId)

      if (!Number.isNaN(actorId)) {
        const admin = await Admin.query()
          .select(['id', 'firstname', 'lastname', 'email'])
          .where('id', actorId)
          .first()

        if (admin) {
          actor = {
            id: admin.id,
            firstname: admin.firstname,
            lastname: admin.lastname,
            email: admin.email,
          }
        }
      }
    }

    return AuditLogDetailsResponseDTO.fromLog(log, actor)
  }
}
