import User from 'app/features/user/domain/models/user.js'

export interface PurchaseAirtimeRequestDto {
  serviceType: string
  fromProviderCode: string
  toProviderCode: string
  msisdn: string
  amount: number
  currency?: string
  user?: User
}
