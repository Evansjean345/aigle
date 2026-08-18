import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type Refund from '#core/money/transactions/domain/models/refund'
import type { RefundReason, RefundType } from '#core/money/transactions/domain/enums/refund'

export interface ListRefundsFilter {
  walletId?: number
  userId?: string
  adminId?: number
  transactionId?: number
  type?: RefundType
  reason?: RefundReason
  search?: string
  /** Comptes dont le titulaire correspond au terme, résolus par l'annuaire en amont. */
  searchAccountIds?: string[]
  minAmount?: number
  maxAmount?: number
  startDate?: string
  endDate?: string
  /** Nom de tri déclaré dans `refundSorts`. Sans lui, l'ordre par défaut du dépôt. */
  sortBy?: string
  order?: 'asc' | 'desc'
}

export default abstract class RefundRepository {
  /**
   * Creates a new refund record.
   */
  abstract create(data: Partial<Refund>, trx?: TransactionClientContract): Promise<Refund>

  /**
   * Finds a refund by transaction ID.
   */
  abstract findByTransactionId(transactionId: number): Promise<Refund | null>

  /**
   * Retrieves a paginated list of refunds with optional filters.
   */
  abstract list(
    page: number,
    perPage: number,
    filters?: ListRefundsFilter
  ): Promise<ModelPaginatorContract<Refund>>
}
