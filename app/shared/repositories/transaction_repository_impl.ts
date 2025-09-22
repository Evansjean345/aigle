import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Transaction from '#shared/models/transaction'
import TransactionRepository from '#shared/interfaces/repositories/transaction.repository'

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
   * Retrieves a transaction record by matching either the unique user identifier (UID) or the record's numeric ID.
   *
   * @param {string | number} id - The unique identifier, which can be either a string-based UID or a numeric ID.
   * @return {Promise<Transaction|null>} A promise that resolves to the transaction record if found, or null if no matching record exists.
   */
  async findByUidOrId(id: string | number): Promise<Transaction | null> {
    return await Transaction.query().where('transactions_uid', id).orWhere('id', id).first()
  }

  /** Find by reference string */
  async findByReference(reference: string): Promise<Transaction | null> {
    return await Transaction.query().where('reference', reference).first()
  }
}
