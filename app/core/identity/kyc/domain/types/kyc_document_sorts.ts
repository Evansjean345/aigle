/**
 * Colonnes ouvertes au tri de la file de revue, nom exposé par l'API à gauche, colonne réelle à
 * droite.
 *
 * Le validateur tire son énumération des clés, le dépôt lit la valeur. Une colonne absente de cette
 * table n'est donc ni acceptée ni traduisible : le client ne nomme jamais une colonne librement.
 */
export const kycDocumentSorts = {
  submittedAt: 'created_at',
  status: 'status',
} as const

/** Nom de tri accepté par la file de revue. */
export type KycDocumentSort = keyof typeof kycDocumentSorts

/** Noms de tri acceptés, à passer à `vine.enum`. */
export const kycDocumentSortNames = Object.keys(kycDocumentSorts) as KycDocumentSort[]

/** Traduit un nom de tri en colonne. Rend `null` pour tout nom hors de la table. */
export function kycDocumentSortColumn(sortBy: string | undefined): string | null {
  if (!sortBy) return null
  return kycDocumentSorts[sortBy as KycDocumentSort] ?? null
}
