import { type ListQuery } from '#shared/domain/types/list_query'

/**
 * Critères de la file de revue, tels que le dépôt les reçoit.
 *
 * Ne porte pas de terme de recherche : le dépôt filtre sur des comptes, qu'un annuaire a résolus en
 * amont. Il ignore donc si un compte est une personne ou une entreprise.
 */
export interface KycDocumentQuery extends Pick<ListQuery, 'sortBy' | 'order'> {
  status?: string
  documentType?: string
  /** Compte unique. Filtre direct, sans passer par un annuaire. */
  userId?: string
  /**
   * Comptes auxquels restreindre la file.
   *
   * Absent, aucun filtre ne s'applique. Vide, la file l'est aussi.
   */
  accountIds?: string[]
  /** Nature du dossier : pièces d'identité ou dossier d'organisation. */
  ownerType?: string
  startDate?: string
  endDate?: string
}
