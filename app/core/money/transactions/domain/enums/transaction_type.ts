export enum TransactionType {
  // ── Commun (core) ──
  REFUNDED = 'refunded',

  // ── Consumer ──
  DEPOSIT = 'deposit',
  TRANSFERT = 'transfert',
  WALLET_TRANSFERT = 'wallet_transfert',
  TRANSFERT_INTER = 'inter_reseau',

  // ── Business (ajoutés au Lot 6) ──
  CHECKOUT = 'checkout',
  // Pas de type `payout` : un décaissement business vers un compte externe est un `TRANSFERT`
  // (taxonomie unifiée). Le `'payout'` provider (gateway cash-out) est un concept distinct.
  // MASS_PAYOUT = 'mass_payout',
}
