/**
 * Statut d'un membre d'organisation.
 * - ACTIVE : membre opérationnel.
 * - PENDING : invitation en attente du consentement du user (lien + OTP).
 * - REMOVED : membre autrefois actif, retiré (retrait soft, historique conservé).
 *   NB : une invitation PENDING annulée est supprimée (hard delete), pas passée REMOVED.
 */
export enum MemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
  REMOVED = 'removed',
}
