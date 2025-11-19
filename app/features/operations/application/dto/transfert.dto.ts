import { TransactionStatus } from '#shared/models/transaction'

export interface TransfertRequestDto {
  amount: number
  providerId: number
  providerCode: string
  phone: string
  serviceType: string
  paymentMethodCode: string
  paymentMethodId: number
  pinCode?: string
  include_fees?: boolean
}

export interface TransfertResponseDto {
  message: string
  data: {
    transactionReference: string
    status: TransactionStatus
  }
}
