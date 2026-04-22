import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type AuditLog from '#features/audit/domain/models/audit_log'

export interface ListAuditLogsFilter {
  eventCategory?: string
  eventAction?: string
  actorId?: string
  actorType?: string
  actorRole?: string
  targetType?: string
  targetId?: string
  result?: string
  search?: string
  startDate?: string
  endDate?: string
}

export default abstract class AuditLogRepository {
  /**
   * Retrieves a paginated list of audit logs with optional filters.
   */
  abstract list(
    page: number,
    perPage: number,
    filters?: ListAuditLogsFilter
  ): Promise<ModelPaginatorContract<AuditLog>>

  /**
   * Finds an audit log by its UUID.
   */
  abstract findById(id: string): Promise<AuditLog | null>
}
