/**
 * Contrat de données d'une entrée d'audit. Type de domaine (pur), partagé entre
 * l'application (émetteurs de l'événement) et l'infrastructure (enregistreur).
 */
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
