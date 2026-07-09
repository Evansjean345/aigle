import { type AuditResult } from '#core/audit/domain/enums'
import { type BusinessTraceContext, emitBusinessAudit } from '#aiglebusiness/shared/business_audit'

/**
 * Contexte de trace du flux auth business. Alias du contexte business générique — le
 * canal y est toujours présent (validé par le middleware businessChannel en amont).
 */
export type BusinessAuthTraceContext = BusinessTraceContext

/**
 * Émet un événement d'audit catégorie AUTH pour le flux business (check-phone, login,
 * verify). Fine couche au-dessus de `emitBusinessAudit` : acteur et cible = User.
 */
export function emitBusinessAuthAudit(
  context: BusinessAuthTraceContext,
  event: {
    eventAction: string
    actorId?: string | null
    result: AuditResult
    errorCode?: string | null
    errorMessage?: string | null
    metadata?: Record<string, unknown>
  }
): void {
  emitBusinessAudit(context, {
    eventCategory: 'AUTH',
    eventAction: event.eventAction,
    actorId: event.actorId,
    targetType: 'User',
    targetId: event.actorId,
    result: event.result,
    errorCode: event.errorCode,
    errorMessage: event.errorMessage,
    metadata: event.metadata,
  })
}
