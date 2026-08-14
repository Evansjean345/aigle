/**
 * Forme commune des requêtes de liste du back-office : pagination, recherche, tri.
 *
 * Partagée par les dépôts de plusieurs features, elle vit dans `shared/` pour qu'aucune d'elles
 * n'ait à dépendre d'une autre pour en disposer. Forme plate, sans invariant : la validation se fait
 * à la frontière HTTP, par Vine.
 */
export interface ListQuery {
  page: number
  perPage: number
  /** Terme de recherche déjà normalisé. Le validateur en garantit la longueur minimale. */
  search?: string
  /** Nom exposé par l'API, clé d'une table de tri. Jamais un nom de colonne. */
  sortBy?: string
  order?: 'asc' | 'desc'
}