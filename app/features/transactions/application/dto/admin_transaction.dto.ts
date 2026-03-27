import { DateTime } from 'luxon'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentResponseDTO } from '#features/transactions/application/dto/payment.dto'

export interface AdminTransactionResponseDTO {
  id: number
  transactionUid: string
  reference: string
  amount: number
  fees: number
  totalAmount: number
  operationType: string
  direction: TransactionDirection
  status: string
  description: string | null
  createdAt: DateTime
  updatedAt: DateTime
  payment: PaymentResponseDTO[]
  user?: {
    id: string
    firstname: string
    lastname: string
    wallet: {
      balance: number
    }
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
    balanceBefore: number
    createdAt: DateTime
  }
  securityContext?: {
    ipAddress: string
    deviceId: string | null
    userAgent: string | null
    osVersion: string | null
    appVersion: string | null
    countryCode: string | null
    city: string | null
    isVpn: boolean
    riskScore: number | null
    capturedAt: DateTime
  }
  logs?: {
    id: number
    eventType: string
    status: string
    errorMessage: string | null
    ipAddress: string | null
    actorId: string | null
    actorType: string | null
    createdAt: DateTime
  }[]
}

export interface PaginationMeta {
  total: number
  currentPage: number
  lastPage: number
  firstPage: number
  perPage: number
}

export interface PaginatedAdminTransactionsResponseDTO {
  data: AdminTransactionResponseDTO[]
  meta: PaginationMeta
}

export interface UserTransactionsStatsDTO {
  totalInVolume: number
  totalOutVolume: number
  transferVolume: number
  interNetworkVolume: number
  walletTransferVolume: number
  totalFees: number
  avgTransactionValue: number
  successRate: number
  failureRate: number
  successCount: number
  failedCount: number
  pendingCount: number
  totalCount: number
}
