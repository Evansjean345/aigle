import type { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'

/**
 * Critères de listage paginé des membres d'une organisation.
 *
 * Contrat du port : la validation se fait à la frontière HTTP, ces champs sont déjà normalisés.
 * Chaque filtre absent signifie « ne restreint pas », jamais « valeur nulle ».
 */
export interface ListOrganisationMembersQuery {
  page: number
  perPage: number
  status?: MemberStatus
  /**
   * Restreint à ces utilisateurs.
   *
   * Sert la recherche par nom : les noms vivent dans le core identité, pas sur cette table. Elles
   * sont résolues en amont, puis converties en liste d'identifiants — le module ne référence donc
   * jamais la table `users`. Une liste **vide** signifie « aucune correspondance », et doit rendre
   * une page vide, pas toutes les lignes.
   */
  userIds?: string[]
}
