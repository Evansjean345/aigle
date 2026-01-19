import Ledger from '#features/ledger/domain/models/ledger'
import LedgerRepository from '#features/ledger/domain/interfaces/ledger_repository'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { LedgerDirection, LedgerOperationType } from '#features/ledger/domain/ledger_enums'

/**
 * Implementation of the LedgerRepository interface for managing ledger entities.
 */
export default class LedgerRepositoryImpl implements LedgerRepository {
  /**
   * Creates and saves a new Ledger instance with the provided data.
   *
   * @param {Partial<Ledger>} data - The partial data to initialize the Ledger instance.
   * @param {TransactionClientContract} [trx] - Optional transaction client to be used for saving the Ledger instance.
   * @return {Promise<Ledger>} A promise that resolves to the created Ledger instance.
   */
  async create(data: Partial<Ledger>, trx?: TransactionClientContract): Promise<Ledger> {
    const ledger = new Ledger()
    Object.assign(ledger, data)

    if (trx) {
      return await ledger.useTransaction(trx).save()
    }

    return await ledger.save()
  }

  /**
   * Retrieves a list of ledger entries associated with the specified transaction ID.
   *
   * @param {number} transactionId - The unique identifier of the transaction to search for.
   * @return {Promise<Ledger[]>} A promise that resolves to an array of Ledger objects matching the transaction ID.
   */
  async findByTransactionId(transactionId: number): Promise<Ledger[]> {
    return await Ledger.query().where('transactionId', transactionId).exec()
  }

  /**
   * Retrieves a list of Ledger entries corresponding to the given wallet ID.
   *
   * @param {number} walletId - The unique identifier of the wallet.
   * @return {Promise<Ledger[]>} A promise that resolves to an array of Ledger entries matching the wallet ID.
   */
  async findByWalletId(walletId: number): Promise<Ledger[]> {
    return await Ledger.query().where('walletId', walletId).exec()
  }

  /**
   * Retrieves all ledger entries with pagination and filters.
   *
   * @param {number} page - The page number to retrieve.
   * @param {number} perPage - The number of entries per page.
   * @param {object} filters - Filtering criteria.
   * @return {Promise<any>} A promise that resolves to a paginated list of Ledger objects.
   */
  async findAll(
    page: number,
    perPage: number,
    filters?: {
      walletId?: number
      direction?: string
      operationType?: LedgerOperationType | string
      startDate?: string
      endDate?: string
    }
  ): Promise<ModelPaginatorContract<Ledger>> {
    const query = Ledger.query()
      .withScopes((scopes) => {
        scopes.filterByWallet(filters?.walletId)
        scopes.filterByDirection(filters?.direction)
        scopes.filterByOperationType(filters?.operationType)
        scopes.filterByStartDate(filters?.startDate)
        scopes.filterByEndDate(filters?.endDate)
      })
      .select([
        'id',
        'direction',
        'operation_type',
        'description',
        'amount_brut',
        'fees',
        'total_amount',
        'balance_before',
        'balance_after',
        'created_at',
        'transaction_id',
        'wallet_id',
      ])
      .preload('transaction', (transactionQuery) => {
        transactionQuery.select(['id', 'reference', 'operation_type', 'status', 'description'])
      })
      .preload('wallet', (walletQuery) => {
        walletQuery.select(['id', 'user_id']).preload('user', (userQuery) => {
          userQuery.select(['firstname', 'lastname', 'picture_url'])
        })
      })
      .orderBy('createdAt', 'desc')

    return await query.paginate(page, perPage)
  }

  /**
   * Retrieves global statistics for the ledger.
   *
   * @param {object} filters - Filtering criteria for statistics.
   * @return {Promise<any>} A promise that resolves to ledger statistics.
   */
  async getStats(filters: { walletId?: number; period?: string }): Promise<any> {
    const dateFilter = this.getDateFilter(filters.period || '30d')

    const baseQuery = () =>
      Ledger.query().withScopes((scopes) => {
        scopes.filterByWallet(filters.walletId)
        if (dateFilter) {
          scopes.filterByStartDate(dateFilter.toSQL()!)
        }
      })

    const totalIn = await baseQuery()
      .where('direction', LedgerDirection.CREDIT)
      .sum('total_amount as total')
      .first()
    const totalOut = await baseQuery()
      .where('direction', LedgerDirection.DEBIT)
      .sum('total_amount as total')
      .first()
    const totalFees = await baseQuery().sum('fees as total').first()
    const transactionCount = await baseQuery().count('* as total').first()

    const inAmount = Number(totalIn?.$extras.total || 0)
    const outAmount = Number(totalOut?.$extras.total || 0)

    return {
      total_in: inAmount,
      total_out: outAmount,
      total_fees: Number(totalFees?.$extras.total || 0),
      transaction_count: Number(transactionCount?.$extras.total || 0),
      net_flow: inAmount - outAmount,
      period: filters.period || '30d',
    }
  }

  /**
   * Retrieves chart data for ledger evolution.
   *
   * @param {object} filters - Filtering criteria for chart data.
   * @return {Promise<any>} A promise that resolves to chart data.
   */
  async getChartData(filters: {
    walletId?: number
    period?: string
    groupBy?: 'day' | 'week' | 'month'
  }): Promise<any[]> {
    const dateFilter = this.getDateFilter(filters.period || '30d')
    const groupBy = filters.groupBy || 'day'

    const dateFormat =
      groupBy === 'month' ? 'YYYY-MM' : groupBy === 'week' ? 'YYYY-WW' : 'YYYY-MM-DD'

    return Ledger.query()
      .select(
        db.raw(`TO_CHAR(created_at, '${dateFormat}') as date`),
        db.raw(`SUM(CASE WHEN direction = 'CREDIT' THEN total_amount ELSE 0 END) as total_in`),
        db.raw(`SUM(CASE WHEN direction = 'DEBIT' THEN total_amount ELSE 0 END) as total_out`),
        db.raw(`SUM(fees) as fees`),
        db.raw(`COUNT(*) as count`)
      )
      .withScopes((scopes) => {
        scopes.filterByWallet(filters.walletId)
        if (dateFilter) {
          scopes.filterByStartDate(dateFilter.toSQL()!)
        }
      })
      .groupByRaw(`TO_CHAR(created_at, '${dateFormat}')`)
      .orderByRaw(`TO_CHAR(created_at, '${dateFormat}') ASC`)
  }

  /**
   * Generates a date filter based on the specified period.
   *
   * @param {string} period - The time period for filtering. Accepted values are:
   *                          '7d' for the last 7 days,
   *                          '30d' for the last 30 days,
   *                          '90d' for the last 90 days.
   * @return {import('luxon').DateTime | null} A DateTime object corresponding to the specified period,
   *                                           or null if the period is invalid.
   */
  private getDateFilter(period: string): import('luxon').DateTime | null {
    const now = DateTime.now()
    switch (period) {
      case '7d':
        return now.minus({ days: 7 })
      case '30d':
        return now.minus({ days: 30 })
      case '90d':
        return now.minus({ days: 90 })
      default:
        return null
    }
  }
}
