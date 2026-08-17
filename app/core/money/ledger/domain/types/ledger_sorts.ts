/**
 * Colonnes ouvertes au tri des écritures comptables, nom exposé par l'API à gauche, colonne réelle
 * à droite.
 *
 * Le validateur tire son énumération des clés, le dépôt lit la valeur. Une colonne absente de cette
 * table n'est donc ni acceptée ni traduisible.
 *
 * `amount` traduit `total_amount`, le montant que la liste affiche — `amount_brut`, hors frais,
 * n'est pas ouvert.
 */
export const ledgerSorts = {
  occurredAt: 'created_at',
  amount: 'total_amount',
  fees: 'fees',
  direction: 'direction',
  operationType: 'operation_type',
} as const

/** Nom de tri accepté par la liste des écritures. */
export type LedgerSort = keyof typeof ledgerSorts

/** Noms de tri acceptés, à passer à `vine.enum`. */
export const ledgerSortNames = Object.keys(ledgerSorts) as LedgerSort[]

/** Traduit un nom de tri en colonne. Rend `null` pour tout nom hors de la table. */
export function ledgerSortColumn(sortBy: string | undefined): string | null {
  if (!sortBy) return null

  return ledgerSorts[sortBy as LedgerSort] ?? null
}