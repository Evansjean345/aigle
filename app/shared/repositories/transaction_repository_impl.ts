import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#shared/models/transaction'
import TransactionRepository from '#shared/interfaces/repositories/transaction.repository'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

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
      .where('usersUid', userId)
      .orderBy('createdAt', 'desc')
      .paginate(page, perPage)
  }

  /**
   * Retrieves a transaction record by matching either the unique user identifier (UID) or the record's numeric ID.
   *
   * @param {string | number} id - The unique identifier, which can be either a string-based UID or a numeric ID.
   * @return {Promise<Transaction|null>} A promise that resolves to the transaction record if found, or null if no matching record exists.
   */
  async findByUidOrId(id: string | number): Promise<Transaction | null> {
    return await Transaction.query().where('transactionsUid', id).orWhere('id', id).first()
  }

  /**
   * Fetches a transaction record that matches the provided reference.
   *
   * @param {string} reference - The unique reference to search for in the transaction records.
   * @return {Promise<Transaction|null>} A promise resolving to the transaction object if found, or null if no matching record exists.
   */
  async findByReference(reference: string): Promise<Transaction | null> {
    return await Transaction.query().where('reference', reference).first()
  }

  /**
   * Finds a transaction based on the provided reference and user ID.
   *
   * @param {string} reference - The unique reference identifier of the transaction.
   * @param {string} userId - The unique identifier of the user associated with the transaction.
   * @return {Promise<Transaction | null>} A promise that resolves to the matching transaction object if found, or null if no match is found.
   */
  async findByReferenceAndUserId(reference: string, userId: string): Promise<Transaction | null> {
    return await Transaction.query()
      .preload('payment')
      .where('reference', reference)
      .where('usersUid', userId)
      .first()
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
}
