export interface PurchaseAirtimeResultDto {
  reference: string
  status: 'PENDING' | 'SUCCESS' | 'FAILED'
  providerTxId?: string
  message?: string
}
