import { type DateTime } from 'luxon'
import { type TransactionDirection } from '#core/transactions/domain/enums/transaction_direction'
import { PaymentResponseDTO } from '#core/transactions/application/dto/payment.dto'
import type Transaction from '#core/transactions/domain/models/transaction'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

export class MobileTransactionResponseDTO {
  declare transactionId: string
  declare reference: string
  declare amount: number
  declare fees: number
  declare totalAmount: number
  declare operationType: string
  declare status: string
  declare balanceAfter: number
  declare direction: TransactionDirection
  declare dateTransaction: DateTime
  declare payment: PaymentResponseDTO[]

  static fromTransaction(transaction: Transaction): MobileTransactionResponseDTO {
    const dto = new MobileTransactionResponseDTO()

    let paymentResponse: PaymentResponseDTO[] = []

    if (transaction.payment && transaction.payment.length > 0) {
      paymentResponse = transaction.payment.map(PaymentResponseDTO.fromPaymentMobile)
    }

    dto.transactionId = transaction.transactionsUid
    dto.fees = transaction.fees
    dto.operationType = transaction.operationType
    dto.totalAmount = transaction.totalAmount
    dto.amount = transaction.amount
    dto.direction = transaction.direction
    dto.balanceAfter = transaction.ledgers?.[0]?.balanceAfter ?? 0
    dto.reference = transaction.reference
    dto.status = transaction.status
    dto.dateTransaction = transaction.createdAt
    dto.payment = paymentResponse
    return dto
  }

  static async fromPaginator(
    paginatedTransactions: ModelPaginatorContract<Transaction>
  ): Promise<PaginatedMobileTransactionsResponseDTO> {
    const items = paginatedTransactions.all()
    return {
      data: items.map(MobileTransactionResponseDTO.fromTransaction),
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

export interface PaginatedMobileTransactionsResponseDTO {
  data: MobileTransactionResponseDTO[]
  meta: PaginationMeta
}
