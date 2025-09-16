import Transaction from '#models/transaction'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { TransactionContract } from '../contracts/transaction_interface.js'

/**
 * Handles operations related to transactions within the transaction repository.
 * Implements the `TransactionInterface` to define the core functionality for managing transaction records.
 */
export default class TransactionRepository implements TransactionContract {
  /**
   * Creates and saves a transaction using the given transaction client.
   *
   * @param {Transaction} transaction - The transaction instance to be saved.
   * @param {TransactionClientContract} trx - The transaction client to be used for saving the transaction.
   * @return {Promise<Transaction>} A Promise resolving to the saved transaction instance.
   */
  async save(transaction: Transaction, trx?: TransactionClientContract): Promise<Transaction> {
    if (trx) return transaction.useTransaction(trx).save()
    return transaction.save()
  }

  /**
   * Retrieves a transaction record by matching either the unique user identifier (UID) or the record's numeric ID.
   *
   * @param {string | number} id - The unique identifier, which can be either a string-based UID or a numeric ID.
   * @return {Promise<Transaction|null>} A promise that resolves to the transaction record if found, or null if no matching record exists.
   */
  async findByUidOrId(id: string | number): Promise<Transaction | null> {
    return Transaction.query().where('transactions_uid', id).orWhere('id', id).first()
  }
}
