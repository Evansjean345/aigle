export enum RefundStatus {
  EXECUTED = 'executed',
}

export enum RefundReason {
  OPERATOR_FAILURE = 'operator_failure',
  DISPUTE = 'dispute',
  OTHER = 'other',
  OPERATOR_ERROR = 'operator_error',
  CUSTOMER_COMPLAINT = 'customer_complaint',
  RECONCILATION_GAP = 'reconciliation_gap',
}

export enum RefundType {
  AUTO_REVERSE = 'auto_reversal',
  WEBHOOK_REVERSE = 'webhook_reversal',
  ADMIN_MANUAL_REVERSE = 'admin_manual',
}
