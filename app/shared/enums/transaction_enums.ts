export enum TransactionType {
  DEPOSIT = 'deposit',
  TRANSFERT = 'transfert',
  WALLET_TRANSFERT = 'wallet_transfert',
  TRANSFERT_INTER = 'inter_reseau',
}

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export enum TransactionDirection {
  DEBIT = 'debit',
  CREDIT = 'credit',
  EXTERNAL = 'external',
}
