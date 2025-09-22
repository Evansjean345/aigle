import Wallet from '#shared/models/wallet'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import WalletRepository, {
  AdjustedBalance,
} from '#shared/interfaces/repositories/wallet_repository'

/**
 * Repository class responsible for managing operations related to Wallet entities.
 */
export default class WalletRepositoryImpl implements WalletRepository {
  /**
   * Creates and saves a new Wallet instance with the given data.
   * If a transaction client is provided, the operation is performed within that transaction.
   *
   * @param {Partial<Wallet>} data - The partial data object to populate the new Wallet instance.
   * @param {TransactionClientContract} [trx] - Optional transaction client to perform the operation within a transaction.
   * @return {Promise<Wallet>} The created and saved Wallet instance.
   */
  async create(data: Partial<Wallet>, trx?: TransactionClientContract): Promise<Wallet> {
    const wallet = new Wallet()
    Object.assign(wallet, data)

    if (trx) {
      return await wallet.useTransaction(trx).save()
    }

    return await wallet.save()
  }

  /**
   * Retrieves a wallet entity by its unique identifier.
   *
   * @param {number} id - The unique identifier of the wallet to retrieve.
   * @return {Promise<Wallet | null>} A promise resolving to the wallet entity if found, or null if no matching wallet is found.
   */
  async findById(id: number): Promise<Wallet | null> {
    return Wallet.find(id)
  }

  /**
   * Fetches the wallet information for a specific user by their user ID.
   *
   * @param {string} userId - The unique identifier of the user whose wallet information is to be retrieved.
   * @return {Promise<Wallet | null>} A promise that resolves to the wallet associated with the given user ID, or null if no wallet is found.
   */
  async findByUserId(userId: string): Promise<Wallet | null> {
    return await Wallet.query().where('userId', userId).first()
  }

  /**
   * Saves the provided wallet instance to the database, optionally using the specified transaction.
   *
   * @param {Wallet} wallet - The wallet instance to be saved.
   * @param {TransactionClientContract} [trx] - Optional transaction instance to use for saving the wallet.
   * @return {Promise<Wallet>} Returns a promise that resolves to the saved wallet instance.
   */
  async save(wallet: Wallet, trx?: TransactionClientContract): Promise<Wallet> {
    if (trx) {
      return await wallet.useTransaction(trx).save()
    }

    return await wallet.save()
  }

  /**
   * Adjusts the balance of a wallet by a specified delta amount.
   *
   * @param {number} id - The unique identifier of the wallet.
   * @param {number} delta - The amount by which the balance should be adjusted. Can be positive or negative.
   * @param {TransactionClientContract} [trx] - An optional transaction client to be used for the operation.
   * @return {Promise<Wallet | null>} Returns the updated wallet object if found, or null if the wallet does not exist.
   */
  async adjustBalance(
    id: number,
    delta: number,
    trx?: TransactionClientContract
  ): Promise<AdjustedBalance | null> {
    console.log('debugging delta')
    console.log(Math.abs(delta))

    const wallet = await Wallet.query({ client: trx })
      .where('id', id)
      .where('balance', '>=', delta < 0 ? Math.abs(delta) : 0)
      .forUpdate()
      .first()

    if (!wallet) {
      return null
    }

    wallet.balance = Number(wallet.balance) + delta
    await wallet.save()

    return { id: wallet.id, balance: wallet.balance }
  }

  /**
   * Adjusts the balance of a wallet by crediting a specified amount.
   *
   * @param {number} id - The unique identifier of the wallet to be credited.
   * @param {number} amount - The amount to be credited to the wallet. Must be a positive number.
   * @param {TransactionClientContract} [trx] - An optional transaction client for database operations.
   * @return {Promise<Wallet | null>} A promise that resolves to the updated Wallet object if the operation is successful, or null if the wallet is not found.
   */
  async creditGuarded(
    id: number,
    amount: number,
    trx?: TransactionClientContract
  ): Promise<AdjustedBalance | null> {
    return this.adjustBalance(id, Math.abs(Number(amount)), trx)
  }

  /**
   * Deducts a specific amount from a wallet's balance in a guarded manner.
   *
   * @param {number} id - The unique identifier of the wallet to debit.
   * @param {number} amount - The amount to be debited. It will always be treated as a positive number.
   * @param {TransactionClientContract} [trx] - An optional database transaction object.
   * @return {Promise<Wallet | null>} A promise that resolves to the updated Wallet object if the operation is successful, or null if the operation fails.
   */
  async debitGuarded(
    id: number,
    amount: number,
    trx?: TransactionClientContract
  ): Promise<AdjustedBalance | null> {
    return this.adjustBalance(id, -Math.abs(Number(amount)), trx)
  }
}
