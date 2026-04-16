export enum AdjustmentType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum AdjustmentReason {
  MISSING_DEBIT = 'missing_debit',
  DUPLICATE_CREDIT = 'duplicate_credit',
  DUPLICATE_DEBIT = 'duplicate_debit',
  RECONCILIATION_GAP = 'reconciliation_gap',
  SYSTEM_ERROR = 'system_error',
  OTHER = 'other',
}

export enum AdjustmentStatus {
  EXECUTED = 'executed',
}
