import Transaction from '#features/transactions/domain/models/transaction'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'

/**
 * An abstract class acting as a repository for managing transaction entities.
 * Provides methods for saving transactions and retrieving them using various identifier criteria.
 */
export default abstract class TransactionRepository {
  /**
   * Creates and saves a transaction using the given transaction client.
   *
   * @param {Transaction} transaction - The transaction instance to be saved.
   * @param {TransactionClientContract} trx - The transaction client to be used for saving the transaction.
   * @return {Promise<Transaction>} A Promise resolving to the saved transaction instance.
   */
  abstract save(transaction: Transaction, trx?: TransactionClientContract): Promise<Transaction>

  /**
   * Retrieves a transaction record by matching either the unique user identifier (UID) or the record's numeric ID.
   *
   * @param {string | number} id - The unique identifier, which can be either a string-based UID or a numeric ID.
   * @param trx - The transaction client to be used for saving the transaction.
   * @return {Promise<Transaction|null>} A promise that resolves to the transaction record if found, or null if no matching record exists.
   */
  abstract findByUidOrId(
    id: string | number,
    trx?: TransactionClientContract
  ): Promise<Transaction | null>

  /**
   * Finds a transaction based on the given reference identifier.
   *
   * @param {string} reference - The unique reference identifier of the transaction.
   * @return {Promise<Transaction | null>} A promise that resolves to the transaction object if found, or null if not found.
   */
  abstract findByReference(reference: string): Promise<Transaction | null>

  /**
   * Finds a transaction by its reference and associated user ID.
   *
   * @param {string} reference - The unique reference identifier of the transaction.
   * @param {string} userId - The unique identifier of the user associated with the transaction.
   * @return {Promise<Transaction | null>} A promise that resolves to the transaction if found, or null if no matching transaction exists.
   */
  abstract findByReferenceAndUserId(reference: string, userId: string): Promise<Transaction | null>

  /**
   * Retrieves the latest transactions for a specific user, up to a specified limit.
   *
   * @param {string} userId - The unique identifier of the user whose transactions are to be retrieved.
   * @param {number | undefined} limit - The maximum number of transactions to retrieve.
   * @return {Promise<Transaction[]>} A promise that resolves to an array of the user's latest transactions.
   */
  abstract getLatestTransactionByUserId(userId: string, limit?: number): Promise<Transaction[]>

  /**
   * Fetches a paginated list of transactions associated with a specific user.
   *
   * @param {string} userId - The unique identifier for the user.
   * @param {number} page - The current page number to retrieve.
   * @param {number} perPage - The number of transactions to fetch per page.
   * @return {Promise<ModelPaginatorContract<Transaction>>} A promise resolving to the paginated list of transactions.
   */
  abstract getAllByUserId(
    userId: string,
    page: number,
    perPage?: number
  ): Promise<ModelPaginatorContract<Transaction>>

  /**
   * Fetches a paginated list of all transactions.
   *
   * @param {number} [page] - The page number to retrieve. Optional.
   * @param {number} [perPage] - The number of items per page. Optional.
   * @param {Object} [filters] - Optional filters.
   * @param {TransactionType} [filters.type] - Filter by transaction type.
   * @param {TransactionStatus} [filters.status] - Filter by transaction status.
   * @param {string} [filters.search] - Search term.
   * @return {Promise<ModelPaginatorContract<Transaction>>} A promise that resolves to a paginated list of transactions.
   */
  abstract all(
    page?: number,
    perPage?: number,
    filters?: {
      type?: TransactionType
      status?: TransactionStatus
      search?: string
      startDate?: string
      endDate?: string
      userId?: string
    }
  ): Promise<ModelPaginatorContract<Transaction>>

  /**
   * Counts the number of successful transactions for a user on a specific date.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {string} date - The date (YYYY-MM-DD).
   * @return {Promise<number>}
   */
  abstract countSuccessByDate(userId: string, date: string): Promise<number>

  /**
   * Retrieves the last successful transaction for a user.
   *
   * @param {string} userId - The unique identifier of the user.
   * @return {Promise<Transaction | null>}
   */
  abstract findLastSuccessByUserId(userId: string): Promise<Transaction | null>

  /**
   * Retrieves detailed statistics for transactions.
   *
   * @param {Object} options - Filtering options.
   * @param {string} options.userId - Optional user ID to filter stats.
   * @param {string} [options.startDate] - Optional start date filter.
   * @param {string} [options.endDate] - Optional end date filter.
   * @return {Promise<{
   *   totalIn: number,
   *   totalOut: number,
   *   transferVolume: number,
   *   interNetworkVolume: number,
   *   walletTransferVolume: number,
   *   totalFees: number,
   *   count: number,
   *   successCount: number,
   *   failedCount: number,
   *   pendingCount: number
   * }>}
   */
  abstract getStats(options?: { userId?: string; startDate?: string; endDate?: string }): Promise<{
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
  }>
}
