import { DateTime } from 'luxon'
import { TransactionDirection } from '#features/transactions/domain/models/transaction'
import { PaymentResponseDTO } from '#features/transactions/application/dto/payment.dto'

export interface TransactionResponseDTO {
  transactionId: string
  reference: string
  amount: number
  fees: number
  totalAmount: number
  operationType: string
  status: string
  balanceAfter: number
  direction: TransactionDirection
  dateTransaction: DateTime<boolean>
  payment: PaymentResponseDTO[]
}

export interface Meta {
  total: number
  currentPage: number
  lastPage: number
  firstPage: number
}

export interface PaginatedTransactionsResponseDTO {
  data: TransactionResponseDTO[]
  meta: Meta
}
