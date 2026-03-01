import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'

export interface DepositRequestDto {
  amount: number
  providerId: number
  providerCode: string
  phone: string
  serviceType: string
  paymentMethodCode: string
  paymentMethodId: number
  pinCode?: string
}

export interface DepositResponseDto {
  message: string
  data: {
    transactionReference: string
    status: TransactionStatus
    wave_url?: string
  }
}
