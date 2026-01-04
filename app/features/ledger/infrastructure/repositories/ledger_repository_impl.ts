import Ledger from '#features/ledger/domain/models/ledger'
import LedgerRepository from '#features/ledger/domain/interfaces/ledger_repository'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'

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
}
