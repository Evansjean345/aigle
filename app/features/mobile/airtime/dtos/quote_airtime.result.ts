export interface QuoteAirtimeResultDto {
  amount: number
  currency?: string
  feeFixed: number
  feePercent: number
  feeAmount: number
  total: number
  fromProviderCode: string
  toProviderCode: string
}
