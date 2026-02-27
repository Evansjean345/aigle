import { DateTime } from 'luxon'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentResponseDTO } from '#features/transactions/application/dto/payment.dto'

export interface MobileTransactionResponseDTO {
  transactionId: string
  reference: string
  amount: number
  fees: number
  totalAmount: number
  operationType: string
  status: string
  balanceAfter: number
  direction: TransactionDirection
  dateTransaction: DateTime
  payment: PaymentResponseDTO[]
}

export interface PaginationMeta {
  total: number
  currentPage: number
  lastPage: number
  firstPage: number
  perPage: number
}

export interface PaginatedMobileTransactionsResponseDTO {
  data: MobileTransactionResponseDTO[]
  meta: PaginationMeta
}
