/**
 * Statut d'un membre d'organisation.
 * - ACTIVE : membre opérationnel.
 * - PENDING : ajout en attente du consentement du user (OTP) — utilisé au Lot B.
 */
export enum MemberStatus {
  ACTIVE = 'active',
  PENDING = 'pending',
}