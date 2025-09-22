import WalletRepository from '#shared/interfaces/repositories/wallet_repository'
import { inject } from '@adonisjs/core'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { toWalletCreatedResult } from '#mobile/wallet/mappers/wallet.mapper'
import { WalletCreatedResult } from '#mobile/wallet/dtos/wallet_created_result'
import Wallet from '#shared/models/wallet'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Service for managing wallets, including creation, retrieval, and balance adjustments.
 */
@inject()
export default class WalletService {
  /**
   * Constructs an instance of the class.
   *
   * @param {WalletRepository} walletRepository - The repository used to interact with wallet data.
   */
  constructor(private walletRepository: WalletRepository) {}

  /**
   * Creates a wallet for the specified user if it doesn't already exist.
   * If a wallet already exists for the user, returns the existing wallet details.
   *
   * @param {string} userId - The parameters containing user details and wallet specifications.
   * @param {TransactionClientContract} [trx] - Optional transaction client for database operations.
   * @return {Promise<WalletCreatedResult>} A promise that resolves with the details of the created or existing wallet.
   */
  async createForUser(
    userId: string,
    trx?: TransactionClientContract
  ): Promise<WalletCreatedResult> {
    const existing = await this.walletRepository.findByUserId(userId)
    if (existing) return toWalletCreatedResult(existing)

    const walletCreated = await this.walletRepository.create(
      {
        userId,
        currencySymbol: 'XOF',
        balance: 0,
      },
      trx
    )
    return toWalletCreatedResult(walletCreated)
  }

  /**
   * Retrieves a wallet associated with a specific user ID.
   *
   * @param {string} userId - The unique identifier of the user whose wallet is to be retrieved.
   * @return {Promise<Wallet>} A promise that resolves to the wallet associated with the given user ID.
   * @throws {Exception} If no wallet is found for the provided user ID, an exception is thrown with a status of 404 and code 'WALLET_NOT_FOUND'.
   */
  async getByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findByUserId(userId)

    if (!wallet) {
      throw new Exception('Wallet not found', { status: 404, code: 'WALLET_NOT_FOUND' })
    }

    return wallet
  }

  /**
   * Credits the specified amount to the user's wallet balance.
   *
   * @param {number} walletId - The unique identifier of the wallet to be credited.
   * @param {number} amount - The amount to be credited to the wallet balance. Must be greater than zero.
   * @param {TransactionClientContract} [trx] - Optional transaction object used for database consistency.
   * @return {Promise<{id: number, balance: number} | null>} A promise that resolves to an object containing the wallet ID and updated balance if the operation is successful, or null if the update fails.
   */
  async creditBalance(
    walletId: number,
    amount: number,
    trx?: TransactionClientContract
  ): Promise<{ id: number; balance: number } | null> {
    if (amount <= 0) throw new Exception('Invalid amount', { status: 422, code: 'INVALID_AMOUNT' })
    const updated = await this.walletRepository.creditGuarded(walletId, amount, trx)

    if (!updated) return null

    return { id: updated.id, balance: updated.balance ?? 0 }
  }

  /**
   * Deducts a specified amount from the wallet balance in a secure and guarded manner.
   *
   * @param {number} walletId - The unique identifier of the wallet to be debited.
   * @param {number} amount - The amount to debit from the wallet. Must be greater than zero.
   * @param {TransactionClientContract} [trx] - Optional transaction context for database operations.
   * @return {Promise<{ id: number, balance: number } | null>} An object containing the updated wallet id and balance if the operation is successful. Returns null if the transaction fails.
   * @throws {Exception} Throws an exception if the amount is invalid or if there are insufficient funds.
   */
  async debitBalance(
    walletId: number,
    amount: number,
    trx?: TransactionClientContract
  ): Promise<{ id: number; balance: number } | null> {
    if (amount <= 0) throw new Exception('Invalid amount', { status: 422, code: 'INVALID_AMOUNT' })
    const updated = await this.walletRepository.debitGuarded(walletId, amount, trx)

    if (!updated) {
      throw new Exception('Solde insuffisant', { status: 409, code: 'INSUFFICIENT_FUNDS' })
    }

    return { id: updated.id, balance: updated.balance ?? 0 }
  }
}
