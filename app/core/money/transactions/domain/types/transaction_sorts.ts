/**
 * Colonnes ouvertes au tri de la liste des transactions, nom exposé par l'API à gauche, colonne
 * réelle à droite.
 *
 * Le validateur tire son énumération des clés, le dépôt lit la valeur. Une colonne absente de cette
 * table n'est donc ni acceptée ni traduisible.
 *
 * `amount` désigne le montant net, celui qu'affiche la liste — `total_amount`, qui inclut les
 * frais, n'est pas ouvert : trier sur un chiffre que la ligne ne montre pas rend l'ordre
 * inexplicable.
 */
export const transactionSorts = {
  occurredAt: 'created_at',
  amount: 'amount',
  fees: 'fees',
  status: 'status',
  operationType: 'operation_type',
} as const

/** Nom de tri accepté par la liste des transactions. */
export type TransactionSort = keyof typeof transactionSorts

/** Noms de tri acceptés, à passer à `vine.enum`. */
export const transactionSortNames = Object.keys(transactionSorts) as TransactionSort[]

/** Traduit un nom de tri en colonne. Rend `null` pour tout nom hors de la table. */
export function transactionSortColumn(sortBy: string | undefined): string | null {
  if (!sortBy) return null

  return transactionSorts[sortBy as TransactionSort] ?? null
}