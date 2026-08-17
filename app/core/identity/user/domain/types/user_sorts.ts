/**
 * Colonnes ouvertes au tri de la liste des utilisateurs, nom exposé par l'API à gauche, colonne
 * réelle à droite.
 *
 * Le validateur tire son énumération des clés, le dépôt lit la valeur. Une colonne absente de cette
 * table n'est donc ni acceptée ni traduisible.
 */
export const userSorts = {
  createdAt: 'created_at',
  lastname: 'lastname',
} as const

/** Nom de tri accepté par la liste des utilisateurs. */
export type UserSort = keyof typeof userSorts

/** Noms de tri acceptés, à passer à `vine.enum`. */
export const userSortNames = Object.keys(userSorts) as UserSort[]

/** Traduit un nom de tri en colonne. Rend `null` pour tout nom hors de la table. */
export function userSortColumn(sortBy: string | undefined): string | null {
  if (!sortBy) return null

  return userSorts[sortBy as UserSort] ?? null
}
