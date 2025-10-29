export interface QuoteAirtimeRequestDto {
  serviceType: string
  fromProviderCode: string
  toProviderCode: string
  amount: number
  currency?: string
}
