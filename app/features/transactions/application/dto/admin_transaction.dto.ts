import { DateTime } from 'luxon'
import { TransactionDirection } from '#features/transactions/domain/models/transaction'
import { PaymentResponseDTO } from '#features/transactions/application/dto/payment.dto'

export interface AdminTransactionResponseDTO {
  id: number
  transactionUid: string
  reference: string
  amount: number
  fees: number
  totalAmount: number
  balanceBefore: number
  balanceAfter: number
  operationType: string
  direction: TransactionDirection
  status: string
  description: string | null
  createdAt: DateTime
  updatedAt: DateTime
  payment: PaymentResponseDTO[]
  user: {
    id: string
    firstname: string
    lastname: string
  }
  ledgers?: {
    id: number
    walletId: number
    walletLabel?: string
    walletCurrencySymbol?: string
    direction: string
    amountBrut: number
    fees: number
    totalAmount: number
    balanceAfter: number
    createdAt: DateTime
  }[]
}

export interface Meta {
  total: number
  currentPage: number
  lastPage: number
  firstPage: number
}

export interface PaginatedAdminTransactionsResponseDTO {
  data: AdminTransactionResponseDTO[]
  meta: Meta
}
