import AuditLog from '#features/audit/domain/models/audit_log'
import { randomUUID } from 'node:crypto'

export type AuditRecordInput = {
  // Event structure
  eventCategory?: string | null
  eventAction?: string | null

  // Actor
  actorId?: string | number | null
  actorType?: string | null
  actorRole?: string | null

  // Initiator
  initiatedById?: string | number | null
  initiatedByType?: string | null

  // Target
  targetType?: string | null
  targetId?: string | null

  // Request context
  requestId?: string | null
  ipAddress?: string | null
  userAgent?: string | null

  // Data
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null

  // Outcome
  result?: string | null
  errorCode?: string | null
  errorMessage?: string | null
}

/**
 * A service for handling audit logging within the application.
 */
class AuditService {
  /**
   * Records an audit log entry with the given input details.
   *
   * @param {AuditRecordInput} input - The input data for the audit log entry, including event structure, actor/target info, request context, and result.
   * @return {Promise<void>} A promise that resolves when the audit log entry has been successfully recorded.
   */
  async record(input: AuditRecordInput): Promise<void> {
    await AuditLog.create({
      id: randomUUID(),
      eventCategory: input.eventCategory ?? null,
      eventAction: input.eventAction ?? null,

      actorId: input.actorId ?? null,
      actorType: input.actorType ?? null,
      actorRole: input.actorRole ?? null,

      initiatedBy: input.initiatedById ?? null,
      initiatedByType: input.initiatedByType ?? null,

      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,

      requestId: input.requestId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,

      oldValues: input.oldValues ?? null,
      newValues: input.newValues ?? null,
      metadata: input.metadata ?? null,

      result: input.result ?? null,
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
    })
  }
}

const auditService = new AuditService()
export default auditService
