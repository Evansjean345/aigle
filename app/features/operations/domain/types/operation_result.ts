export interface OperationTransactionRef {
  id: number
  transactionsUid: string
  reference: string
  status: string
  amount: number
  totalAmount: number
  fees: number
}

export interface OperationPaymentRef {
  id: number
  paymentsUid: string
  status: string
}

export interface OperationResult {
  transaction: OperationTransactionRef
  payment: OperationPaymentRef
  message: string
}
