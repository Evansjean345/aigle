import { inject } from '@adonisjs/core'
import { AuditRecordInput } from '#shared/infrastructure/logging/audit_service'
import auditService from '#shared/infrastructure/logging/audit_service'

@inject()
export default class AuditListener {
  /**
   * Handles the provided audit event by recording it via the audit service.
   *
   * @param {AuditRecordInput} data - The audit event data containing details for logging.
   * @return {Promise<void>} A promise that resolves when the event data is successfully recorded.
   */
  async handle(data: AuditRecordInput): Promise<void> {
    await auditService.record(data)
  }
}
