export enum LedgerDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
  EXTERNAL = 'EXTERNAL',
}

export enum LedgerOperationType {
  DEPOSIT = 'deposit',
  TRANSFERT = 'transfer',
  WALLET_TRANSFERT = 'wallet_transfer',
  TRANSFERT_INTER = 'inter_transfer',
  DEPOSIT_INTER = 'deposit_inter',
  TRANSFERT_INTER_STEP = 'transfert_inter',
  REVERSAL = 'reversal',
  ADJUSTMENT = 'adjustment',
  /** Hold d'un lot de transfert de masse (débit gardé du total, sans transaction — L2-D4). */
  RESERVATION = 'reservation',
  /** Libération d'un hold (rejet/annulation d'un lot) — recrédit du total, sans transaction. */
  RESERVATION_RELEASE = 'reservation_release',
}
