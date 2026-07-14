/**
 * Statut opérationnel d'un compte — **synchronisé** depuis le propriétaire (push-sync) : identity
 * pousse `user.status`, le produit pousse `organisation.status`, à chaque changement. C'est le
 * statut « party » lu par la validation money (`getStanding`).
 *
 * Distinct du **gel argent** (`WalletStatus`, sur le wallet) et du **niveau** (limites). Un compte
 * `BLOCKED` refuse tout mouvement, quelle que soit la cause (blocage admin, brute-force auth, etc.).
 */
export enum AccountStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}
