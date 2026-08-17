import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type AuditLog from '#core/audit/domain/models/audit_log'

/** Critères de sélection de la file d'audit. Un champ absent ne restreint rien. */
export interface ListAuditLogsFilter {
  eventCategory?: string
  eventAction?: string
  actorId?: string
  actorType?: string
  actorRole?: string
  /** Compte au nom duquel l'acteur a agi, quand l'action est déléguée. */
  initiatedById?: string
  initiatedByType?: string
  targetType?: string
  targetId?: string
  /** Trace d'une requête HTTP entière : tous ses événements portent le même identifiant. */
  requestId?: string
  ipAddress?: string
  errorCode?: string
  result?: string
  search?: string
  startDate?: string
  endDate?: string
}

/** Ordre de la file. Sans `sortBy`, le dépôt applique son ordre par défaut. */
export interface ListAuditLogsSort {
  sortBy?: string
  order?: 'asc' | 'desc'
}

export default abstract class AuditLogRepository {
  /**
   * Rend une page de la file d'audit.
   *
   * @param {number} page - Page demandée, à partir de 1.
   * @param {number} perPage - Lignes par page.
   * @param {ListAuditLogsFilter} [filters] - Critères de sélection.
   * @param {ListAuditLogsSort} [sort] - Ordre demandé.
   * @returns {Promise<ModelPaginatorContract<AuditLog>>} La page et ses métadonnées.
   */
  abstract list(
    page: number,
    perPage: number,
    filters?: ListAuditLogsFilter,
    sort?: ListAuditLogsSort
  ): Promise<ModelPaginatorContract<AuditLog>>

  /**
   * Trouve un événement par son identifiant.
   *
   * @param {string} id - Identifiant UUID de l'événement.
   * @returns {Promise<AuditLog | null>} L'événement, ou `null` s'il n'existe pas.
   */
  abstract findById(id: string): Promise<AuditLog | null>
}
