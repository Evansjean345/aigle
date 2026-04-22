import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import AuditLog from '#features/audit/domain/models/audit_log'
import type AuditLogRepository from '#features/audit/domain/interfaces/audit_log_repository'
import type { ListAuditLogsFilter } from '#features/audit/domain/interfaces/audit_log_repository'

export default class AuditLogRepositoryImpl implements AuditLogRepository {
  /**
   * Retrieves a paginated list of audit logs with optional filters.
   * @param {number} page - The page number.
   * @param {number} perPage - The number of items per page.
   * @param {ListAuditLogsFilter} [filters] - Optional filter criteria.
   * @return {Promise<ModelPaginatorContract<AuditLog>>} Paginated audit logs ordered by createdAt desc.
   */
  async list(
    page: number,
    perPage: number,
    filters?: ListAuditLogsFilter
  ): Promise<ModelPaginatorContract<AuditLog>> {
    const query = AuditLog.query()

    if (filters?.eventCategory) query.where('event_category', filters.eventCategory)
    if (filters?.eventAction) query.where('event_action', filters.eventAction)
    if (filters?.actorId) query.where('actor_id', filters.actorId)
    if (filters?.actorType) query.where('actor_type', filters.actorType)
    if (filters?.actorRole) query.where('actor_role', filters.actorRole)
    if (filters?.targetType) query.where('target_type', filters.targetType)
    if (filters?.targetId) query.where('target_id', filters.targetId)
    if (filters?.result) query.where('result', filters.result)
    if (filters?.startDate) query.where('created_at', '>=', filters.startDate)
    if (filters?.endDate) query.where('created_at', '<=', filters.endDate)

    if (filters?.search) {
      const term = `%${filters.search}%`
      query.where((builder) => {
        builder
          .where('event_action', 'like', term)
          .orWhere('event_category', 'like', term)
          .orWhere('target_id', 'like', term)
          .orWhere('error_message', 'like', term)
          .orWhere('request_id', 'like', term)
          .orWhere('ip_address', 'like', term)
      })
    }

    return query.orderBy('created_at', 'desc').paginate(page, perPage)
  }

  /**
   * Finds an audit log by its UUID primary key.
   * @param {string} id - The audit log UUID.
   * @return {Promise<AuditLog | null>} The matching record or null.
   */
  async findById(id: string): Promise<AuditLog | null> {
    return AuditLog.find(id)
  }
}
