import Ledger from '#features/ledger/domain/models/ledger'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import { LedgerOperationType } from '#features/ledger/domain/ledger_enums'

export default abstract class LedgerRepository {
  /**
   * Creates a new ledger record in the database.
   *
   * @param {Partial<Ledger>} data - The partial ledger object containing the data to create the new record.
   * @param {TransactionClientContract} [trx] - Optional transaction client to use for the database operation.
   * @return {Promise<Ledger>} A promise that resolves to the newly created ledger record.
   */
  abstract create(data: Partial<Ledger>, trx?: TransactionClientContract): Promise<Ledger>

  /**
   * Finds and retrieves a list of ledger entries associated with the given transaction ID.
   *
   * @param {number} transactionId - The unique identifier of the transaction whose ledger entries are to be retrieved.
   * @return {Promise<Ledger[]>} A promise that resolves to an array of ledger entries associated with the specified transaction ID.
   */
  abstract findByTransactionId(transactionId: number): Promise<Ledger[]>

  /**
   * Fetches a list of ledger entries associated with the given wallet ID.
   *
   * @param {number} walletId - The unique identifier of the wallet whose ledger entries are to be retrieved.
   * @return {Promise<Ledger[]>} A promise resolving to an array of Ledger objects associated with the specified wallet ID.
   */
  abstract findByWalletId(walletId: number): Promise<Ledger[]>

  /**
   * Retrieves all ledger entries with pagination and filters.
   *
   * @param {number} page - The page number to retrieve.
   * @param {number} perPage - The number of entries per page.
   * @param {object} filters - Filtering criteria.
   * @return {Promise<any>} A promise that resolves to a paginated list of Ledger objects.
   */
  abstract findAll(
    page: number,
    perPage: number,
    filters?: {
      walletId?: number
      direction?: string
      operationType?: LedgerOperationType | string
      startDate?: string
      endDate?: string
    }
  ): Promise<ModelPaginatorContract<Ledger>>

  /**
   * Retrieves global statistics for the ledger.
   *
   * @param {object} filters - Filtering criteria for statistics.
   * @return {Promise<any>} A promise that resolves to ledger statistics.
   */
  abstract getStats(filters: { walletId?: number; period?: string }): Promise<any>

  /**
   * Retrieves chart data for ledger evolution.
   *
   * @param {object} filters - Filtering criteria for chart data.
   * @return {Promise<any>} A promise that resolves to chart data.
   */
  abstract getChartData(filters: {
    walletId?: number
    period?: string
    groupBy?: 'day' | 'week' | 'month'
  }): Promise<any[]>
}
