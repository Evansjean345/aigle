/**
 * Colonnes ouvertes au tri de la liste des ajustements, nom exposé par l'API à gauche, colonne
 * réelle à droite.
 *
 * Le validateur tire son énumération des clés, le dépôt lit la valeur. Une colonne absente de cette
 * table n'est donc ni acceptée ni traduisible.
 *
 * `occurredAt` traduit `executed_at`, la date de l'ajustement effectif — `created_at` marque
 * l'enregistrement de la ligne, que la liste n'affiche pas.
 */
export const walletAdjustmentSorts = {
  occurredAt: 'executed_at',
  amount: 'amount',
  type: 'type',
  reason: 'reason',
  balanceAfter: 'balance_after',
} as const

/** Nom de tri accepté par la liste des ajustements. */
export type WalletAdjustmentSort = keyof typeof walletAdjustmentSorts

/** Noms de tri acceptés, à passer à `vine.enum`. */
export const walletAdjustmentSortNames = Object.keys(
  walletAdjustmentSorts
) as WalletAdjustmentSort[]

/** Traduit un nom de tri en colonne. Rend `null` pour tout nom hors de la table. */
export function walletAdjustmentSortColumn(sortBy: string | undefined): string | null {
  if (!sortBy) return null

  return walletAdjustmentSorts[sortBy as WalletAdjustmentSort] ?? null
}