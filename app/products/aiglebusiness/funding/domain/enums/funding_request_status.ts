/**
 * Cycle de vie d'une demande de réapprovisionnement.
 *
 * `pending` et `pending_second_approval` sont les deux états ouverts. `cancelled`, `approved` et
 * `rejected` sont terminaux : aucune transition n'en revient.
 */
export enum FundingRequestStatus {
  /** Déclarée par le marchand, en attente de vérification. */
  PENDING = 'pending',
  /** Retirée par le marchand avant vérification. */
  CANCELLED = 'cancelled',
  /**
   * Constatée par un premier gestionnaire, en attente de confirmation par un second.
   *
   * Aucun argent n'a encore bougé.
   */
  PENDING_SECOND_APPROVAL = 'pending_second_approval',
  /** Vérifiée par un gestionnaire, wallet crédité. */
  APPROVED = 'approved',
  /** Refusée par un gestionnaire, avec motif. Aucun mouvement d'argent. */
  REJECTED = 'rejected',
}
