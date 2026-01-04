import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'

export interface WalletToWalletRequestDto {
  token?: string
  recipient_phone: string
  amount: number
}

export interface WalletToWalletResponseDto {
  message: string
  data: {
    reference: string
    status: TransactionStatus
  }
}
