import User from '#features/authentication/domain/models/user'

export interface PurchaseAirtimeRequestDto {
  serviceType: string
  fromProviderCode: string
  toProviderCode: string
  msisdn: string
  amount: number
  currency?: string
  user?: User
}
