import { TransactionStatus } from '#shared/models/transaction'

export interface InterTransfertRequestDto {
  amount: number
  serviceType: string
  // debiting side (from)
  providerFromId: number
  providerFromCode: string
  debiteurPhone: string
  paymentMethodDepositCode: string
  paymentMethodDepositId: number
  pinCode?: string
  // crediting side (to)
  providerToId: number
  providerToCode: string
  beneficiairePhone: string
  paymentMethodTransfertCode: string
  paymentMethodTransfertId: number
}

export interface InterTransfertResponseDto {
  message: string
  data: {
    transactionReference: string
    status: TransactionStatus
  }
}
