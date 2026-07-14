import Ledger from '#core/money/ledger/domain/models/ledger'
import type LedgerRepository from '#core/money/ledger/domain/interfaces/ledger_repository'
import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { LedgerDirection, type LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'

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
      search?: string
      userId?: string
    }
  ): Promise<ModelPaginatorContract<Ledger>> {
    const query = Ledger.query()
      .withScopes((scopes) => {
        scopes.filterByWallet(filters?.walletId)
        scopes.filterByDirection(filters?.direction)
        scopes.filterByOperationType(filters?.operationType)
        scopes.filterByUser(filters?.userId)
        if (filters?.startDate || filters?.endDate) {
          scopes.filterByDateRange(filters.startDate, filters.endDate)
        }
        if (filters?.search) {
          scopes.search(filters.search)
        }
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
        // Account-centric : le titulaire est résolu par `account_id` (wallet → account → owner)
        // via `LedgerHolderResolver` — plus de preload du FK hérité `user_id`.
        walletQuery.select(['id', 'account_id'])
      })
      .orderBy('createdAt', 'desc')

    return await query.paginate(page, perPage)
  }

  /**
   * Retrieves statistics and metrics based on wallet transactions within a specified period.
   *
   * @param {Object} filters - The filters to apply for calculating statistics.
   * @param {number} [filters.walletId] - The ID of the wallet to filter transactions. If not specified, statistics will consider all wallets.
   * @param {string} [filters.period='30d'] - The time period for filtering transactions (e.g., '30d' for the last 30 days). Defaults to the last 30 days if not provided.
   * @return {Promise<Object>} An object containing the calculated metrics:
   * - `total_in`: The total incoming amount for the specified wallet and period.
   * - `total_out`: The total outgoing amount for the specified wallet and period.
   * - `total_fees`: The total transaction fees within the specified wallet and period.
   * - `transaction_count`: The total count of transactions within the specified wallet and period.
   * - `total_external`: Thee total external transactions within the specified wallet and period.
   * - `period`: The period used for calculations.
   */
  async getStats(filters: {
    walletId?: number
    period?: string
    startDate?: string
    endDate?: string
  }): Promise<Record<string, any>> {
    const baseQuery = Ledger.query().withScopes((scopes) => {
      scopes.filterByWallet(filters.walletId)

      if (filters.startDate || filters.endDate) {
        console.log(filters.startDate, filters.endDate)
        scopes.filterByDateRange(filters.startDate, filters.endDate)
      }
    })

    const result = await baseQuery
      .select(
        db.raw('COUNT(*) as total'),
        db.raw('SUM(CASE WHEN direction = ? THEN total_amount ELSE 0 END) as total_in', [
          LedgerDirection.CREDIT,
        ]),
        db.raw('SUM(CASE WHEN direction = ? THEN total_amount ELSE 0 END) as total_out', [
          LedgerDirection.DEBIT,
        ]),
        db.raw('SUM(CASE WHEN direction = ? THEN total_amount ELSE 0 END) as total_external', [
          LedgerDirection.EXTERNAL,
        ]),
        db.raw('SUM(fees) as total_fees')
      )
      .first()

    const stats = result?.$extras || {}

    return {
      total_in: Number(stats.total_in || 0),
      total_out: Number(stats.total_out || 0),
      total_external: Number(stats.total_external || 0),
      total_fees: Number(stats.total_fees || 0),
      transaction_count: Number(stats.total || 0),
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
        db.raw(`SUM(CASE WHEN direction = ? THEN total_amount ELSE 0 END) as total_in`, [
          LedgerDirection.CREDIT,
        ]),
        db.raw(`SUM(CASE WHEN direction = ? THEN total_amount ELSE 0 END) as total_out`, [
          LedgerDirection.DEBIT,
        ]),
        db.raw(`SUM(CASE WHEN direction = ? THEN total_amount ELSE 0 END) as total_out`, [
          LedgerDirection.EXTERNAL,
        ]),
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
