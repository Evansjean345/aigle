export interface PaymentRef {
  id: number
  paymentsUid: string
  transactionsId: number
  transactionsUid: string
  step: string
  operationType: string
  paymentMethod: string
  paymentDetails: string
  status: string
}
