import Transaction from '#models/transaction'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

export abstract class TransactionContract {
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
   * @return {Promise<Transaction|null>} A promise that resolves to the transaction record if found, or null if no matching record exists.
   */
  abstract findByUidOrId(id: string | number): Promise<Transaction | null>
}
