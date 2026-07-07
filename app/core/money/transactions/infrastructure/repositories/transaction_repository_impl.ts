import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#core/money/transactions/domain/models/transaction'
import type TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import db from '@adonisjs/lucid/services/db'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'

/**
 * Handles operations related to transactions within the transaction repository.
 * Implements the `TransactionContract` to define the core functionality for managing transaction records.
 */
export default class TransactionRepositoryImpl implements TransactionRepository {
  /**
   * Creates and saves a transaction using the given transaction client.
   *
   * @param {Transaction} transaction - The transaction instance to be saved.
   * @param {TransactionClientContract} trx - The transaction client to be used for saving the transaction.
   * @return {Promise<Transaction>} A Promise resolving to the saved transaction instance.
   */
  async save(transaction: Transaction, trx?: TransactionClientContract): Promise<Transaction> {
    if (trx) return await transaction.useTransaction(trx).save()
    return await transaction.save()
  }

  /**
   * Retrieves a paginated list of transactions associated with a specific user ID.
   *
   * @param {string} userId - The unique identifier of the user whose transactions are to be retrieved.
   * @param {number} page - The page number of the paginated results.
   * @param {number} [perPage=16] - The number of transactions per page. Defaults to 16 if not specified.
   * @return {Promise<Transaction[]>} A promise that resolves to a paginated list of transactions.
   */
  async getAllByUserId(
    userId: string,
    page: number,
    perPage: number = 16
  ): Promise<ModelPaginatorContract<Transaction>> {
    return await Transaction.query()
      .preload('payment')
      .preload('ledgers')
      .where('usersUid', userId)
      .orderBy('createdAt', 'desc')
      .paginate(page, perPage)
  }

  /**
   * Retrieves a transaction record by matching either the unique user identifier (UID) or the record's numeric ID.
   *
   * @param {string | number} id - The unique identifier, which can be either a string-based UID or a numeric ID.
   * @param trx - The transaction client to be used for saving the transaction.
   * @return {Promise<Transaction|null>} A promise that resolves to the transaction record if found, or null if no matching record exists.
   */
  async findByUidOrId(
    id: string | number,
    trx?: TransactionClientContract
  ): Promise<Transaction | null> {
    const query = Transaction.query({ client: trx })
      .preload('user')
      .preload('payment')
      .preload('ledgers', (q) => {
        q.preload('wallet')
      })
      .where((builder) => {
        builder.where('transactionsUid', id).orWhere('id', id)
      })

    if (trx) {
      query.forUpdate()
    }

    return await query.first()
  }

  /**
   * Finds a transaction by its unique identifier.
   *
   * @param {number} id - The unique identifier of the transaction to find.
   * @param {TransactionClientContract} [trx] - Optional database transaction client to use for the query.
   * @return {Promise<Transaction | null>} A promise that resolves to the transaction if found, or null if not found.
   */
  async findById(id: number, trx?: TransactionClientContract): Promise<Transaction | null> {
    const query = Transaction.query({ client: trx }).where('id', id)
    if (trx) {
      query.forUpdate()
    }

    return await query.first()
  }

  /**
   * Fetches a transaction record that matches the provided reference.
   *
   * @param {string} reference - The unique reference to search for in the transaction records.
   * @param {string[]} preloads - Optional array of relations to preload.
   * @return {Promise<Transaction|null>} A promise resolving to the transaction object if found, or null if no matching record exists.
   */
  async findByReference(reference: string, preloads?: string[]): Promise<Transaction | null> {
    const query = Transaction.query()

    query
      .if(preloads?.includes('user'), (q) => {
        q.preload('user', (userQuery) => {
          userQuery.preload('wallet', (walletQuery) => {
            walletQuery.select(['id', 'balance'])
          })
        })
      })
      .if(preloads?.includes('payment'), (q) => {
        q.preload('payment')
      })
      .if(preloads?.includes('ledgers'), (q) => {
        q.preload('ledgers', (ledgerQuery) => {
          ledgerQuery.preload('wallet')
        })
      })
      .if(preloads?.includes('logs'), (q) => {
        q.preload('logs')
      })
      .if(preloads?.includes('securityContext'), (q) => {
        q.preload('securityContext', (subQuery) => subQuery.preload('device'))
      })
      .if(preloads?.includes('refund'), (q) => {
        q.preload('refund', (refundQuery) => {
          refundQuery.preload('admin', (adminQuery) => {
            adminQuery.select(['id', 'firstname', 'lastname', 'email'])
          })
        })
      })

    return await query.where('reference', reference).first()
  }

  async lockByReference(
    reference: string,
    trx: TransactionClientContract
  ): Promise<Transaction | null> {
    return await Transaction.query({ client: trx })
      .where('reference', reference)
      .forUpdate()
      .first()
  }

  /**
   * Finds a transaction based on the provided reference and user ID.
   *
   * @param {string} reference - The unique reference identifier of the transaction.
   * @param {string} userId - The unique identifier of the user associated with the transaction.
   * @return {Promise<Transaction | null>} A promise that resolves to the matching transaction object if found, or null if no match is found.
   */
  async findByReferenceAndUserId(
    reference: string,
    userId: string,
    preloads?: string[]
  ): Promise<Transaction | null> {
    const query = Transaction.query()
      .preload('payment')
      .where('reference', reference)
      .where('usersUid', userId)

    if (preloads?.includes('ledgers')) {
      query.preload('ledgers')
    }

    return await query.first()
  }

  /**
   * Retrieves the latest transactions for a specific user based on their user ID.
   *
   * @param {string} userId - The ID of the user whose latest transactions are to be fetched.
   * @param limit
   * @return {Promise<Transaction[]>} A promise that resolves to an array of transactions, ordered by creation date in descending order.
   */
  async getLatestTransactionByUserId(userId: string, limit: number = 8): Promise<Transaction[]> {
    return Transaction.query()
      .preload('payment')
      .where('usersUid', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
  }

  /**
   * Fetches all transactions with their associated user and payment details.
   *
   * @param {number} [page=1] - The page number to retrieve.
   * @param {number} [perPage=50] - The number of transactions per page.
   * @param {Object} [filters] - Optional filters.
   * @return {Promise<ModelPaginatorContract<Transaction>>} A promise that resolves to an array of Transaction objects with preloaded relations.
   */
  async all(
    page: number = 1,
    perPage: number = 50,
    filters?: {
      type?: TransactionType
      status?: TransactionStatus
      search?: string
      startDate?: string
      endDate?: string
      userId?: string
    }
  ): Promise<ModelPaginatorContract<Transaction>> {
    const query = Transaction.query().preload('user').preload('payment')
    query
      .if(filters?.userId, (q) => q.where('usersUid', filters!.userId!))
      .if(filters?.type, (q) => q.withScopes((scope) => scope.filterByType(filters!.type!)))
      .if(filters?.status, (q) => q.withScopes((scope) => scope.filterByStatus(filters!.status!)))
      .if(filters?.search, (q) => q.withScopes((scope) => scope.search(filters!.search!)))
      .if(filters?.startDate || filters?.endDate, (q) =>
        q.withScopes((scope) => scope.filterByDateRange(filters?.startDate, filters?.endDate))
      )

    return query.orderBy('created_at', 'desc').paginate(page, perPage)
  }

  /**
   * Counts the number of successful transactions for a given user on a specified date.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {string} date - The date to filter transactions, in 'YYYY-MM-DD' format.
   * @return {Promise<number>} The total count of successful transactions for the user on the given date.
   */
  async countSuccessByDate(userId: string, date: string): Promise<number> {
    const result = await Transaction.query()
      .where('usersUid', userId)
      .where('status', TransactionStatus.SUCCESS)
      .whereRaw('DATE(created_at) = ?', [date])
      .count('* as total')

    return result[0]?.$extras?.total ? Number(result[0].$extras.total) : 0
  }

  /**
   * Finds the most recent successful transaction for a given user ID.
   *
   * @param {string} userId - The unique identifier of the user whose transaction is being queried.
   * @return {Promise<Transaction | null>} A promise resolving to the latest successful transaction for the user,
   * or null if no such transaction exists.
   */
  async findLastSuccessByUserId(userId: string): Promise<Transaction | null> {
    return await Transaction.query()
      .where('usersUid', userId)
      .where('status', TransactionStatus.SUCCESS)
      .orderBy('created_at', 'desc')
      .first()
  }

  /**
   * Retrieves transaction statistics based on the specified options.
   *
   * @param {Object} [options] - Optional parameters to filter the statistics.
   * @param {string} [options.userId] - The ID of the user for whom the statistics are to be retrieved. If not provided, statistics will be aggregated for all users.
   * @return {Promise<Record<string, number>>} A promise that resolves to an object containing the following transaction statistics:
   * - `totalIn`: The total volume of successful credit transactions.
   * - `totalOut`: The total volume of successful outgoing transactions, including transfers, inter-network transfers, and wallet transfers.
   * - `transferVolume`: The total volume of successful transfer transactions.
   * - `interNetworkVolume`: The total volume of successful inter-network transfer transactions.
   * - `walletTransferVolume`: The total volume of successful wallet transfer transactions.
   * - `totalFees`: The total fees collected from successful transactions.
   * - `count`: The total count of all transactions.
   * - `successCount`: The count of successful transactions.
   * - `failedCount`: The count of failed transactions.
   * - `pendingCount`: The count of pending transactions.
   */
  async getStats(options?: { userId?: string; startDate?: string; endDate?: string }): Promise<{
    totalIn: number
    totalOut: number
    transferVolume: number
    interNetworkVolume: number
    walletTransferVolume: number
    totalFees: number
    count: number
    successCount: number
    failedCount: number
    pendingCount: number
  }> {
    const query = Transaction.query()

    if (options?.userId) {
      query.where('usersUid', options.userId)
    }

    if (options?.startDate || options?.endDate) {
      query.withScopes((scope) => scope.filterByDateRange(options.startDate, options.endDate))
    }

    const result = await query
      .select(
        db.raw('COUNT(*) as totalCount'),
        db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as successCount', [
          TransactionStatus.SUCCESS,
        ]),
        db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failedCount', [
          TransactionStatus.FAILED,
        ]),
        db.raw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pendingCount', [
          TransactionStatus.PENDING,
        ]),
        db.raw(
          `COALESCE(SUM(CASE
                WHEN status = ? AND direction = ? THEN amount
                ELSE 0
          END), 0) as totalIn`,
          [TransactionStatus.SUCCESS, TransactionDirection.CREDIT]
        ),
        db.raw(
          `COALESCE(SUM(CASE
                 WHEN status = ? AND operation_type = ? THEN amount
                 ELSE 0
          END), 0) as transferVolume`,
          [TransactionStatus.SUCCESS, TransactionType.TRANSFERT]
        ),
        db.raw(
          `COALESCE(SUM(CASE
                 WHEN status = ? AND operation_type = ? THEN amount
                 ELSE 0
          END), 0) as interNetworkVolume`,
          [TransactionStatus.SUCCESS, TransactionType.TRANSFERT_INTER]
        ),
        db.raw(
          `COALESCE(SUM(CASE
                 WHEN status = ? AND operation_type = ? AND direction = ? THEN amount
                 ELSE 0
          END), 0) as walletTransferVolume`,
          [TransactionStatus.SUCCESS, TransactionType.WALLET_TRANSFERT, TransactionDirection.DEBIT]
        ),
        db.raw(
          `COALESCE(SUM(CASE
                WHEN status = ? THEN fees
                ELSE 0
          END), 0) as totalFees`,
          [TransactionStatus.SUCCESS]
        )
      )
      .first()

    const stats = result?.$extras || {}

    const transferVolume = Number(stats.transferVolume || 0)
    const interNetworkVolume = Number(stats.interNetworkVolume || 0)
    const walletTransferVolume = Number(stats.walletTransferVolume || 0)

    return {
      totalIn: Number(stats.totalIn || 0),
      totalOut: transferVolume + interNetworkVolume + walletTransferVolume,
      transferVolume: transferVolume,
      interNetworkVolume: interNetworkVolume,
      walletTransferVolume: walletTransferVolume,
      totalFees: Number(stats.totalFees || 0),
      count: Number(stats.totalCount || 0),
      successCount: Number(stats.successCount || 0),
      failedCount: Number(stats.failedCount || 0),
      pendingCount: Number(stats.pendingCount || 0),
    }
  }
}
