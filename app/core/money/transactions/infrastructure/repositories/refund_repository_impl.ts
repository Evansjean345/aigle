import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import Refund from '#core/money/transactions/domain/models/refund'
import type RefundRepository from '#core/money/transactions/domain/interfaces/refund_repository'
import type { ListRefundsFilter } from '#core/money/transactions/domain/interfaces/refund_repository'
import { refundSortColumn } from '#core/money/transactions/domain/types/refund_sorts'

export default class RefundRepositoryImpl implements RefundRepository {
  /**
   * Creates and saves a new Refund entity.
   * @param {Partial<Refund>} data - The partial data to assign to the new Refund.
   * @param {TransactionClientContract} [trx] - Optional transaction client to use for the save operation.
   * @return {Promise<Refund>} The saved Refund entity.
   */
  async create(data: Partial<Refund>, trx?: TransactionClientContract): Promise<Refund> {
    const refund = new Refund()
    Object.assign(refund, data)

    if (trx) {
      return await refund.useTransaction(trx).save()
    }

    return await refund.save()
  }

  /**
   * Finds a refund by its associated transaction ID.
   * @param {number} transactionId - The transaction ID to search for.
   * @return {Promise<Refund | null>} A promise that resolves to the found Refund object, or null if no matching refund exists.
   */
  async findByTransactionId(transactionId: number): Promise<Refund | null> {
    return await Refund.query().where('transactionId', transactionId).first()
  }

  /**
   * Retrieves a paginated list of refunds, optionally filtered by various criteria such as wallet, admin, transaction, amount range, date range, user, or search term. Preloads associated transaction, user, and admin data.
   * @param {number} page - The page number to retrieve.
   * @param {number} perPage - The number of items to retrieve per page.
   * @param {ListRefundsFilter} [filters] - Optional filters to apply to the refund query.
   * @return {Promise<ModelPaginatorContract<Refund>>} A promise that resolves to a paginated list of refunds.
   */
  async list(
    page: number,
    perPage: number,
    filters?: ListRefundsFilter
  ): Promise<ModelPaginatorContract<Refund>> {
    const query = Refund.query()
      .preload('transaction', (txQuery) => {
        txQuery.select(['id', 'reference', 'operation_type', 'account_id'])
      })
      .preload('admin', (adminQuery) => {
        adminQuery.select(['id', 'firstname', 'lastname', 'email'])
      })

    if (filters?.walletId) query.where('wallet_id', filters.walletId)
    if (filters?.adminId) query.where('admin_id', filters.adminId)
    if (filters?.transactionId) query.where('transaction_id', filters.transactionId)
    if (filters?.type) query.where('type', filters.type)
    if (filters?.reason) query.where('reason', filters.reason)
    if (filters?.minAmount !== undefined) query.where('total_refunded', '>=', filters.minAmount)
    if (filters?.maxAmount !== undefined) query.where('total_refunded', '<=', filters.maxAmount)
    if (filters?.startDate) query.where('executed_at', '>=', filters.startDate)
    if (filters?.endDate) query.where('executed_at', '<=', filters.endDate)

    if (filters?.userId) {
      query.whereHas('transaction', (txQuery) => {
        txQuery.where('users_uid', filters.userId!)
      })
    }

    if (filters?.search) {
      const term = `%${filters.search}%`
      const accountIds = filters.searchAccountIds ?? []

      query.where((builder) => {
        builder
          .whereILike('refund_uid', term)
          .orWhereILike('comment', term)
          .orWhereHas('transaction', (txQuery) => {
            txQuery.whereILike('reference', term)

            // Le titulaire arrive résolu en comptes : une transaction d'organisation n'a pas de
            // porteur utilisateur.
            if (accountIds.length > 0) {
              txQuery.orWhereIn('account_id', accountIds)
            }
          })
      })
    }

    // L'ordre se termine toujours par `executed_at desc` : trier sur une colonne à faible
    // cardinalité comme `type` laisserait sinon la pagination rendre deux fois la même ligne.
    const sortColumn = refundSortColumn(filters?.sortBy)
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
