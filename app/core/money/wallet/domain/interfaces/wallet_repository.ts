import { type TransactionClientContract } from '@adonisjs/lucid/types/database'
import type Wallet from '#core/money/wallet/domain/models/wallet'
import { type WalletStatus } from '#core/money/wallet/domain/enums/wallet_status'

export interface AdjustedBalance {
  id: number
  balance: number
}

/**
 * Abstract class representing a repository interface for interacting with Wallet entities.
 * Defines the contract for typical wallet-related operations such as creation, retrieval, updates,
 * and balance management, optionally supporting transactional operations.
 */
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
   * @param trx - Optional transaction client to perform the operation within a transaction.
   * @return {Promise<Wallet | null>} A promise that resolves to the wallet associated with the given user ID, or null if no wallet is found.
   */
  abstract findByUserId(userId: string, trx?: TransactionClientContract): Promise<Wallet | null>

  /**
   * Fetches the wallet by its owning account id (clé pivot account).
   *
   * @param {string} accountId - The account id owning the wallet.
   * @param trx - Optional transaction client.
   * @return {Promise<Wallet | null>} The wallet, or null if none.
   */
  abstract findByAccountId(
    accountId: string,
    trx?: TransactionClientContract
  ): Promise<Wallet | null>

  /**
   * Fetches wallets for a set of account ids (batch — évite le N+1 sur une liste de comptes).
   *
   * @param {string[]} accountIds - The account ids owning the wallets.
   * @param trx - Optional transaction client.
   * @return {Promise<Wallet[]>} The matching wallets (0..n).
   */
  abstract findByAccountIds(
    accountIds: string[],
    trx?: TransactionClientContract
  ): Promise<Wallet[]>

  /**
   * Finds a wallet by its primary key ID.
   *
   * @param {number} id - The wallet ID.
   * @param {TransactionClientContract} [trx] - Optional transaction client.
   * @return {Promise<Wallet | null>}
   */
  abstract findById(id: number, trx?: TransactionClientContract): Promise<Wallet | null>

  /**
   * Saves the provided wallet instance to the database, optionally using the specified transaction.
   *
   * @param {Wallet} wallet - The wallet instance to be saved.
   * @param {TransactionClientContract} [trx] - Optional transaction instance to use for saving the wallet.
   * @return {Promise<Wallet>} Returns a promise that resolves to the saved wallet instance.
   */
  abstract save(wallet: Wallet, trx?: TransactionClientContract): Promise<Wallet>

  /**
   * Adjusts the balance of a wallet based on the provided delta value.
   * This method modifies the wallet's balance and optionally supports transaction handling.
   *
   * @param {number} id - The unique identifier of the wallet.
   * @param {number} delta - The amount to adjust the wallet's balance by. Positive values increase the balance, while negative values decrease it.
   * @param {TransactionClientContract} [trx] - An optional transaction client for handling the balance adjustment within a database transaction.
   * @return {Promise<{ id: number; balance: number } | null>} A promise that resolves to the updated Wallet object if the operation succeeds, or null if the wallet does not exist or the operation fails.
   */
  abstract adjustBalance(
    id: number,
    delta: number,
    trx?: TransactionClientContract
  ): Promise<{ id: number; balance: number } | null>

  /**
   * Performs a guarded credit operation on a wallet. The operation safely credits a specified amount to the wallet identified by its ID, potentially within a given transaction.
   *
   * @param {number} id - The unique identifier of the wallet to be credited.
   * @param {number} amount - The amount to be credited to the wallet.
   * @param {TransactionClientContract} [trx] - An optional transaction client contract for wrapping the operation in a database transaction.
   * @return {Promise<Wallet | null>} A Promise that resolves to the updated Wallet object if the operation is successful, or null if the wallet does not exist or the operation fails.
   */
  abstract creditGuarded(
    id: number,
    amount: number,
    trx?: TransactionClientContract
  ): Promise<AdjustedBalance | null>

  /**
   * Retrieves a wallet associated with the provided QR token.
   *
   * @param {string} token - The QR token used to identify and retrieve the associated wallet.
   * @return {Promise<Wallet>} A promise that resolves to the wallet object associated with the QR token.
   */
  abstract findByQrToken(token: string): Promise<Wallet | null>

  /**
   * Deducts the specified amount from the wallet identified by the given ID in a guarded transaction.
   *
   * @param {number} id - The unique identifier of the wallet to be debited.
   * @param {number} amount - The monetary amount to be deducted from the wallet.
   * @param {TransactionClientContract} [trx] - An optional transaction instance to execute the operation within.
   * @return {Promise<Wallet | null>} A promise that resolves to the updated wallet object if the operation succeeds,
   * or null if the operation fails.
   */
  abstract debitGuarded(
    id: number,
    amount: number,
    trx?: TransactionClientContract
  ): Promise<AdjustedBalance | null>

  /**
   * Updates the status of a wallet.
   *
   * @param {number} id - The unique identifier of the wallet to be updated.
   * @param {WalletStatus} status - The new status to be assigned to the wallet.
   * @param {TransactionClientContract} [trx] - Optional transaction client to perform the operation within a transaction.
   * @return {Promise<Wallet | null>} A promise that resolves to the updated wallet if the operation is successful, or null if the wallet is not found.
   */
  abstract updateStatus(
    id: number,
    status: WalletStatus,
    trx?: TransactionClientContract
  ): Promise<Wallet | null>
}
