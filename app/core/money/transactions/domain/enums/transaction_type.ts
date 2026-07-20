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
  PAYOUT = 'payout',
  // MASS_PAYOUT = 'mass_payout',
}
