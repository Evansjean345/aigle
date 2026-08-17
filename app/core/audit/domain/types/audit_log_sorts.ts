/**
 * Colonnes ouvertes au tri de la file d'audit, nom exposé par l'API à gauche, colonne réelle à
 * droite.
 *
 * Le validateur tire son énumération des clés, le dépôt lit la valeur. Une colonne absente de cette
 * table n'est donc ni acceptée ni traduisible.
 */
export const auditLogSorts = {
  occurredAt: 'created_at',
  eventCategory: 'event_category',
  eventAction: 'event_action',
  actorType: 'actor_type',
  result: 'result',
} as const

/** Nom de tri accepté par la file d'audit. */
export type AuditLogSort = keyof typeof auditLogSorts

/** Noms de tri acceptés, à passer à `vine.enum`. */
export const auditLogSortNames = Object.keys(auditLogSorts) as AuditLogSort[]

/** Traduit un nom de tri en colonne. Rend `null` pour tout nom hors de la table. */
export function auditLogSortColumn(sortBy: string | undefined): string | null {
  if (!sortBy) return null

  return auditLogSorts[sortBy as AuditLogSort] ?? null
}