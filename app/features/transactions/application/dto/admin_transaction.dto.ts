import { type DateTime } from 'luxon'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import { PaymentResponseDTO } from '#features/transactions/application/dto/payment.dto'
import type Transaction from '#features/transactions/domain/models/transaction'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export class AdminTransactionResponseDTO {
  declare id: number
  declare transactionUid: string
  declare reference: string
  declare amount: number
  declare fees: number
  declare totalAmount: number
  declare operationType: string
  declare direction: TransactionDirection
  declare status: string
  declare description: string | null
  declare createdAt: DateTime
  declare updatedAt: DateTime
  declare payment: PaymentResponseDTO[]
  declare user?: {
    id: string
    firstname: string
    lastname: string
    wallet: {
      balance: number
    }
  }
  declare ledgers?: {
    id: number
    walletId: number
    walletLabel?: string
    walletCurrencySymbol?: string
    direction: string
    operationType: string
    amountBrut: number
    fees: number
    totalAmount: number
    balanceAfter: number
    balanceBefore: number
    createdAt: DateTime
  }[]
  declare securityContext?: {
    ipAddress: string
    deviceId: string | null
    deviceUuid: string | null
    userAgent: string | null
    osVersion: string | null
    appVersion: string | null
    countryCode: string | null
    city: string | null
    isVpn: boolean
    riskScore: number | null
    capturedAt: DateTime
  }
  declare logs?: {
    id: number
    eventType: string
    status: string
    errorMessage: string | null
    ipAddress: string | null
    actorId: string | null
    actorType: string | null
    createdAt: DateTime
  }[]

  static fromTransaction(transaction: Transaction): AdminTransactionResponseDTO {
    const dto = new AdminTransactionResponseDTO()

    let paymentResponse: PaymentResponseDTO[] = []
    if (transaction.payment && transaction.payment.length > 0) {
      paymentResponse = transaction.payment.map(PaymentResponseDTO.fromPaymentAdmin)
    }

    dto.id = transaction.id
    dto.transactionUid = transaction.transactionsUid
    dto.reference = transaction.reference
    dto.amount = transaction.amount
    dto.fees = transaction.fees
    dto.totalAmount = transaction.totalAmount
    dto.operationType = transaction.operationType
    dto.direction = transaction.direction
    dto.status = transaction.status
    dto.description = transaction.description
    dto.createdAt = transaction.createdAt
    dto.updatedAt = transaction.updatedAt
    dto.payment = paymentResponse
    dto.user = transaction.user
      ? {
          id: transaction.user.usersUid,
          firstname: transaction.user.firstname,
          lastname: transaction.user.lastname,
          wallet: {
            balance: Number(transaction.user?.wallet?.balance),
          },
        }
      : undefined
    dto.ledgers = transaction.ledgers?.length
      ? transaction.ledgers.map((ledger) => ({
          id: ledger.id,
          walletId: ledger.walletId,
          walletCurrencySymbol: (ledger.wallet as any)?.currencySymbol,
          direction: ledger.direction,
          operationType: ledger.operationType,
          amountBrut: ledger.amountBrut,
          fees: ledger.fees,
          totalAmount: ledger.totalAmount,
          balanceAfter: ledger.balanceAfter,
          balanceBefore: ledger.balanceBefore,
          createdAt: ledger.createdAt,
        }))
      : undefined
    dto.securityContext = transaction.securityContext
      ? {
          ipAddress: transaction.securityContext.ipAddress,
          deviceId: transaction.securityContext.device.id,
          deviceUuid: transaction.securityContext.device.deviceUid,
          userAgent: transaction.securityContext.userAgent,
          osVersion: transaction.securityContext.osVersion,
          appVersion: transaction.securityContext.appVersion,
          countryCode: transaction.securityContext.countryCode,
          city: transaction.securityContext.city,
          isVpn: transaction.securityContext.isVpn,
          riskScore: transaction.securityContext.riskScore,
          capturedAt: transaction.securityContext.capturedAt,
        }
      : undefined
    dto.logs = transaction.logs?.map((log) => ({
      id: log.id,
      eventType: log.eventType,
      status: log.status,
      errorMessage: log.errorMessage,
      ipAddress: log.ipAddress,
      actorId: log.actorId,
      actorType: log.actorType,
      createdAt: log.createdAt,
    }))

    return dto
  }

  static async fromPaginator(
    paginatedTransactions: ModelPaginatorContract<Transaction>
  ): Promise<PaginatedAdminTransactionsResponseDTO> {
    const items = paginatedTransactions.all()
    return {
      data: items.map(AdminTransactionResponseDTO.fromTransaction),
      meta: {
        total: paginatedTransactions.total,
        currentPage: paginatedTransactions.currentPage,
        firstPage: paginatedTransactions.firstPage,
        lastPage: paginatedTransactions.lastPage,
        perPage: paginatedTransactions.perPage,
      },
    }
  }
}

export class PaginationMeta {
  declare total: number
  declare currentPage: number
  declare lastPage: number
  declare firstPage: number
  declare perPage: number
}

export interface PaginatedAdminTransactionsResponseDTO {
  data: AdminTransactionResponseDTO[]
  meta: PaginationMeta
}

export class UserTransactionsStatsDTO {
  declare totalInVolume: number
  declare totalOutVolume: number
  declare transferVolume: number
  declare interNetworkVolume: number
  declare walletTransferVolume: number
  declare totalFees: number
  declare avgTransactionValue: number
  declare successRate: number
  declare failureRate: number
  declare successCount: number
  declare failedCount: number
  declare pendingCount: number
  declare totalCount: number
}
