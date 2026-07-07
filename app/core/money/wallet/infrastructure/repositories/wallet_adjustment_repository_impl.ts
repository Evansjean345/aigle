import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import WalletAdjustment from '#core/money/wallet/domain/models/wallet_adjustment'
import type WalletAdjustmentRepository from '#core/money/wallet/domain/interfaces/wallet_adjustment_repository'
import type { ListWalletAdjustmentsFilter } from '#core/money/wallet/domain/interfaces/wallet_adjustment_repository'

export default class WalletAdjustmentRepositoryImpl implements WalletAdjustmentRepository {
  /**
   *  Create a wallet adjustment entry
   * @param {Partial<WalletAdjustment>} data
   * @param {TransactionClientContract} trx
   */
  async create(
    data: Partial<WalletAdjustment>,
    trx?: TransactionClientContract
  ): Promise<WalletAdjustment> {
    const walletAdjustment = new WalletAdjustment()
    walletAdjustment.merge(data)

    if (trx) {
      return await walletAdjustment.useTransaction(trx).save()
    }

    return await walletAdjustment.save()
  }

  /**
   * Retrieves a paginated list of wallet adjustments with optional filtering and preloaded relations.
   * @param {number} page - The page number for pagination.
   * @param {number} perPage - The number of records per page.
   * @param {ListWalletAdjustmentsFilter} [filters] - Optional filters to apply to the wallet adjustments query.
   * @return {Promise<ModelPaginatorContract<WalletAdjustment>>} A promise that resolves to a paginated list of wallet adjustments.
   */
  async list(
    page: number,
    perPage: number,
    filters?: ListWalletAdjustmentsFilter
  ): Promise<ModelPaginatorContract<WalletAdjustment>> {
    const query = WalletAdjustment.query()
      .preload('wallet', (walletQuery) => {
        walletQuery.preload('user', (userQuery) => {
          userQuery.select(['usersUid', 'firstname', 'lastname'])
        })
      })
      .preload('transaction', (txQuery) => {
        txQuery.select(['id', 'reference'])
      })
      .preload('admin', (adminQuery) => {
        adminQuery.select(['id', 'firstname', 'lastname', 'email'])
      })

    if (filters?.walletId) query.where('wallet_id', filters.walletId)
    if (filters?.adminId) query.where('admin_id', filters.adminId)
    if (filters?.type) query.where('type', filters.type)
    if (filters?.reason) query.where('reason', filters.reason)
    if (filters?.minAmount !== undefined) query.where('amount', '>=', filters.minAmount)
    if (filters?.maxAmount !== undefined) query.where('amount', '<=', filters.maxAmount)
    if (filters?.startDate) query.where('executed_at', '>=', filters.startDate)
    if (filters?.endDate) query.where('executed_at', '<=', filters.endDate)

    if (filters?.userId) {
      query.whereHas('wallet', (walletQuery) => {
        walletQuery.where('user_id', filters.userId!)
      })
    }

    if (filters?.search) {
      const term = `%${filters.search}%`
      query.where((builder) => {
        builder
          .where('adjustment_uid', 'like', term)
          .orWhere('comment', 'like', term)
          .orWhereHas('wallet', (walletQuery) => {
            walletQuery.whereHas('user', (userQuery) => {
              userQuery
                .where('firstname', 'like', term)
                .orWhere('lastname', 'like', term)
                .orWhere('phone', 'like', term)
            })
          })
          .orWhereHas('transaction', (txQuery) => {
            txQuery.where('reference', 'like', term)
          })
      })
    }

    return query.orderBy('executed_at', 'desc').paginate(page, perPage)
  }
}
