import { type DateTime } from 'luxon'
import { type TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import { PaymentResponseDTO } from '#core/money/transactions/application/dtos/payment.dto'
import TransactionDisplayService, {
  type TransactionDisplay,
  type PaymentDetailsInput,
} from '#core/money/transactions/application/services/transaction_display_service'
import type Transaction from '#core/money/transactions/domain/models/transaction'
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
  /**
   * Classification d'affichage dérivée (taxonomie 2026-07) : `kind`/`scope`/`flow` + `counterparty`
   * (privacy-first : contrepartie `user` = `{ phone, operator }`, le nom est résolu en contact local
   * côté app ; seul un marchand porte un `name`). Le libellé et le signe sont composés côté client.
   */
  declare display: TransactionDisplay

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
    dto.display = TransactionDisplayService.toDisplay({
      operationType: transaction.operationType,
      direction: transaction.direction,
      // 'paymentDetails` est parsé en objet par le modèle (colonne JSON) malgré son type `string`.
      paymentDetails: transaction.payment?.[0]
        ?.paymentDetails as unknown as PaymentDetailsInput | null,
      description: transaction.description,
    })
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
