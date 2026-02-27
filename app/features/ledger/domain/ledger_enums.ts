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
}
