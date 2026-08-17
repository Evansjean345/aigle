import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import AuditLog from '#core/audit/domain/models/audit_log'
import type AuditLogRepository from '#core/audit/domain/interfaces/audit_log_repository'
import type {
  ListAuditLogsFilter,
  ListAuditLogsSort,
} from '#core/audit/domain/interfaces/audit_log_repository'
import { auditLogSortColumn } from '#core/audit/domain/types/audit_log_sorts'

/** Neutralise les jokers `%` et `_` pour qu'un terme saisi reste un terme, pas un motif. */
function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export default class AuditLogRepositoryImpl implements AuditLogRepository {
  /**
   * Rend une page de la file d'audit.
   *
   * La recherche est insensible à la casse — la base d'audit est PostgreSQL, où `like` ne l'est
   * pas. L'ordre se termine toujours par `created_at desc` : trier sur une colonne à faible
   * cardinalité comme `result` laisserait sinon la pagination rendre deux fois la même ligne.
   *
   * @param {number} page - Page demandée, à partir de 1.
   * @param {number} perPage - Lignes par page.
   * @param {ListAuditLogsFilter} [filters] - Critères de sélection.
   * @param {ListAuditLogsSort} [sort] - Ordre demandé.
   * @returns {Promise<ModelPaginatorContract<AuditLog>>} La page et ses métadonnées.
   */
  async list(
    page: number,
    perPage: number,
    filters?: ListAuditLogsFilter,
    sort?: ListAuditLogsSort
  ): Promise<ModelPaginatorContract<AuditLog>> {
    const query = AuditLog.query()

    if (filters?.eventCategory) query.where('event_category', filters.eventCategory)
    if (filters?.eventAction) query.where('event_action', filters.eventAction)
    if (filters?.actorId) query.where('actor_id', filters.actorId)
    if (filters?.actorType) query.where('actor_type', filters.actorType)
    if (filters?.actorRole) query.where('actor_role', filters.actorRole)
    if (filters?.initiatedById) query.where('initiated_by_id', filters.initiatedById)
    if (filters?.initiatedByType) query.where('initiated_by_type', filters.initiatedByType)
    if (filters?.targetType) query.where('target_type', filters.targetType)
    if (filters?.targetId) query.where('target_id', filters.targetId)
    if (filters?.requestId) query.where('request_id', filters.requestId)
    if (filters?.ipAddress) query.where('ip_address', filters.ipAddress)
    if (filters?.errorCode) query.where('error_code', filters.errorCode)
    if (filters?.result) query.where('result', filters.result)
    if (filters?.startDate) query.where('created_at', '>=', filters.startDate)
    if (filters?.endDate) query.where('created_at', '<=', filters.endDate)

    if (filters?.search) {
      const term = `%${escapeLikeTerm(filters.search)}%`
      query.where((builder) => {
        builder
          .whereILike('event_action', term)
          .orWhereILike('event_category', term)
          .orWhereILike('target_id', term)
          .orWhereILike('error_message', term)
          .orWhereILike('request_id', term)
          .orWhereILike('ip_address', term)
      })
    }

    const sortColumn = auditLogSortColumn(sort?.sortBy)
    const order = sort?.order ?? 'desc'

    if (sortColumn && sortColumn !== 'created_at') {
      query.orderBy(sortColumn, order)
      query.orderBy('created_at', 'desc')
    } else {
      query.orderBy('created_at', sortColumn ? order : 'desc')
    }

    return query.paginate(page, perPage)
  }

  /**
   * Trouve un événement par son identifiant.
   *
   * @param {string} id - Identifiant UUID de l'événement.
   * @returns {Promise<AuditLog | null>} L'événement, ou `null` s'il n'existe pas.
   */
  async findById(id: string): Promise<AuditLog | null> {
    return AuditLog.find(id)
  }
}