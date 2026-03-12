export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  DRAFT = 'DRAFT',
}

export enum PaymentStep {
  WALLET_TO_WALLET = 'wallet_to_wallet',

  DEPOSIT_INIT = 'deposit_init',
  DEPOSIT_PENDING = 'deposit_pending',
  DEPOSIT_CONFIRMED = 'deposit_confirmed',
  DEPOSIT_FAILED = 'deposit_failed',

  TRANSFERT_INIT = 'transfert_init',
  TRANSFERT_PENDING = 'transfert_pending',
  TRANSFERT_CONFIRMED = 'transfert_confirmed',
  TRANSFERT_FAILED = 'transfert_failed',
}

export enum PaymentMethod {
  MOBILE_MONEY = 'mobile_money',
  WALLET = 'wallet',
  INTERNAL = 'internal',
}
