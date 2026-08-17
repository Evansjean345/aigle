/**
 * Colonnes ouvertes au tri de la liste des organisations, nom exposé par l'API à gauche, colonne
 * réelle à droite.
 *
 * Le validateur tire son énumération des clés, le dépôt lit la valeur. Une colonne absente de cette
 * table n'est donc ni acceptée ni traduisible.
 *
 * Le solde n'y figure pas : il vit dans `wallets`, et la liste l'obtient après pagination.
 */
export const organisationSorts = {
  createdAt: 'created_at',
  level: 'level',
  name: 'name',
} as const

/** Nom de tri accepté par la liste des organisations. */
export type OrganisationSort = keyof typeof organisationSorts

/** Noms de tri acceptés, à passer à `vine.enum`. */
export const organisationSortNames = Object.keys(organisationSorts) as OrganisationSort[]

/** Traduit un nom de tri en colonne. Rend `null` pour tout nom hors de la table. */
export function organisationSortColumn(sortBy: string | undefined): string | null {
  if (!sortBy) return null

  return organisationSorts[sortBy as OrganisationSort] ?? null
}
