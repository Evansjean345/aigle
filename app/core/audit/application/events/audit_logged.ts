import { BaseEvent } from '@adonisjs/core/events'
import { type AuditRecordInput } from '#core/audit/infrastructure/audit_service'

export default class AuditLogged extends BaseEvent {
  /**
   * Represents an audit event with associated data for logging.
   *
   * @param data - The audit event data containing details for logging.
   */
  constructor(public data: AuditRecordInput) {
    super()
  }
}
