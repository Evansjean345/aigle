import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type WalletAdjustment from '#core/money/wallet/domain/models/wallet_adjustment'
import type {
  AdjustmentType,
  AdjustmentReason,
} from '#core/money/wallet/domain/enums/wallet_adjustment'

export interface ListWalletAdjustmentsFilter {
  walletId?: number
  userId?: string
  adminId?: number
  type?: AdjustmentType
  reason?: AdjustmentReason
  search?: string
  minAmount?: number
  maxAmount?: number
  startDate?: string
  endDate?: string
}

export default abstract class WalletAdjustmentRepository {
  /**
   * Creates a new wallet adjustment record.
   *
   * @param {Partial<WalletAdjustment>} data - The adjustment data.
   * @param {TransactionClientContract} [trx] - Optional transaction client.
   * @return {Promise<WalletAdjustment>}
   */
  abstract create(
    data: Partial<WalletAdjustment>,
    trx?: TransactionClientContract
  ): Promise<WalletAdjustment>

  /**
   * Retrieves a paginated list of wallet adjustments with optional filters.
   *
   * @param {number} page - Page number (1-based).
   * @param {number} perPage - Items per page.
   * @param {ListWalletAdjustmentsFilter} [filters] - Optional filters.
   * @return {Promise<ModelPaginatorContract<WalletAdjustment>>}
   */
  abstract list(
    page: number,
    perPage: number,
    filters?: ListWalletAdjustmentsFilter
  ): Promise<ModelPaginatorContract<WalletAdjustment>>
}
