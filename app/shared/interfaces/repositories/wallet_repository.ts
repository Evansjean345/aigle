import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Wallet from '#shared/models/wallet'

export default abstract class WalletRepository {
  /**
   * Creates and saves a new Wallet instance with the given data.
   * If a transaction client is provided, the operation is performed within that transaction.
   *
   * @param {Partial<Wallet>} data - The partial data object to populate the new Wallet instance.
   * @param {TransactionClientContract} [trx] - Optional transaction client to perform the operation within a transaction.
   * @return {Promise<Wallet>} The created and saved Wallet instance.
   */
  abstract create(data: Partial<Wallet>, trx?: TransactionClientContract): Promise<Wallet>

  /**
   * Fetches the wallet information for a specific user by their user ID.
   *
   * @param {string} userId - The unique identifier of the user whose wallet information is to be retrieved.
   * @return {Promise<Wallet | null>} A promise that resolves to the wallet associated with the given user ID, or null if no wallet is found.
   */
  abstract findByUserId(userId: string): Promise<Wallet | null>

  /**
   * Saves the provided wallet instance to the database, optionally using the specified transaction.
   *
   * @param {Wallet} wallet - The wallet instance to be saved.
   * @param {TransactionClientContract} [trx] - Optional transaction instance to use for saving the wallet.
   * @return {Promise<Wallet>} Returns a promise that resolves to the saved wallet instance.
   */
  abstract save(wallet: Wallet, trx?: TransactionClientContract): Promise<Wallet>

  /**
   * Updates a wallet by its ID with the provided data.
   *
   * @param {number} id - The ID of the wallet to update.
   * @param {Partial<Wallet>} data - Partial data to update the wallet with.
   * @param {TransactionClientContract} [trx] - An optional transaction client instance to use for the update.
   * @return {Promise<Wallet | null>} - A promise that resolves with the updated wallet object if found and updated, or null if the wallet does not exist.
   */
  abstract updateById(
    id: number,
    data: Partial<Wallet>,
    trx?: TransactionClientContract
  ): Promise<Wallet | null>

  /**
   * Adjusts the balance of a wallet based on the provided delta value.
   * This method modifies the wallet's balance and optionally supports transaction handling.
   *
   * @param {number} id - The unique identifier of the wallet.
   * @param {number} delta - The amount to adjust the wallet's balance by. Positive values increase the balance, while negative values decrease it.
   * @param {TransactionClientContract} [trx] - An optional transaction client for handling the balance adjustment within a database transaction.
   * @return {Promise<Wallet | null>} A promise that resolves to the updated Wallet object if the operation succeeds, or null if the wallet does not exist or the operation fails.
   */
  abstract adjustBalance(
    id: number,
    delta: number,
    trx?: TransactionClientContract
  ): Promise<Wallet | null>
}
