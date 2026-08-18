import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import WalletAdjustment from '#core/money/wallet/domain/models/wallet_adjustment'
import type WalletAdjustmentRepository from '#core/money/wallet/domain/interfaces/wallet_adjustment_repository'
import type { ListWalletAdjustmentsFilter } from '#core/money/wallet/domain/interfaces/wallet_adjustment_repository'
import { walletAdjustmentSortColumn } from '#core/money/wallet/domain/types/wallet_adjustment_sorts'

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

    // Le compte titulaire, jamais le porteur utilisateur : le portefeuille d'une organisation n'a
    // pas de `user_id`, et joindre `user` rendrait ses ajustements introuvables.
    if (filters?.accountId) {
      query.whereHas('wallet', (walletQuery) => {
        walletQuery.where('account_id', filters.accountId!)
      })
    }

    if (filters?.search) {
      const term = `%${filters.search}%`
      const accountIds = filters.searchAccountIds ?? []

      query.where((builder) => {
        builder.whereILike('adjustment_uid', term).orWhereILike('comment', term)

        // Le titulaire arrive résolu en comptes par l'annuaire, personnes et organisations réunies.
        if (accountIds.length > 0) {
          builder.orWhereHas('wallet', (walletQuery) => {
            walletQuery.whereIn('account_id', accountIds)
          })
        }

        builder.orWhereHas('transaction', (txQuery) => {
          txQuery.whereILike('reference', term)
        })
      })
    }

    // L'ordre se termine toujours par `executed_at desc` : trier sur une colonne à faible
    // cardinalité comme `type` laisserait sinon la pagination rendre deux fois la même ligne.
    const sortColumn = walletAdjustmentSortColumn(filters?.sortBy)
    const order = filters?.order ?? 'desc'

    if (sortColumn && sortColumn !== 'executed_at') {
      query.orderBy(sortColumn, order)
      query.orderBy('executed_at', 'desc')
    } else {
      query.orderBy('executed_at', sortColumn ? order : 'desc')
    }

    return query.paginate(page, perPage)
  }
}
