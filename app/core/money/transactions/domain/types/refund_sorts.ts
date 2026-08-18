/**
 * Colonnes ouvertes au tri de la liste des remboursements, nom exposé par l'API à gauche, colonne
 * réelle à droite.
 *
 * Le validateur tire son énumération des clés, le dépôt lit la valeur. Une colonne absente de cette
 * table n'est donc ni acceptée ni traduisible.
 *
 * `occurredAt` traduit `executed_at`, la date du remboursement effectif — `created_at` marque
 * l'enregistrement de la demande, que la liste n'affiche pas.
 */
export const refundSorts = {
  occurredAt: 'executed_at',
  amount: 'amount',
  type: 'type',
  reason: 'reason',
} as const

/** Nom de tri accepté par la liste des remboursements. */
export type RefundSort = keyof typeof refundSorts

/** Noms de tri acceptés, à passer à `vine.enum`. */
export const refundSortNames = Object.keys(refundSorts) as RefundSort[]

/** Traduit un nom de tri en colonne. Rend `null` pour tout nom hors de la table. */
export function refundSortColumn(sortBy: string | undefined): string | null {
  if (!sortBy) return null

  return refundSorts[sortBy as RefundSort] ?? null
}