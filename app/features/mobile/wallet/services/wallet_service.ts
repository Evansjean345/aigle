import WalletRepository from '#shared/interfaces/repositories/wallet_repository'
import { inject } from '@adonisjs/core'
import { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { AdjustBalanceCommand } from '#mobile/wallet/dtos/adjust_balance.command'
import { toWalletCreatedResult } from '#mobile/wallet/mappers/wallet.mapper'
import { WalletCreatedResult } from '#mobile/wallet/dtos/wallet_created_result'
import Wallet from '#shared/models/wallet'

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
   * Retrieves a wallet associated with the given user ID.
   *
   * @param {string} userId - The ID of the user whose wallet is to be retrieved.
   * @return {Promise<WalletCreatedResult | null>} A promise that resolves to the wallet data as a WalletCreatedResult object if found, or null if no wallet exists for the specified user ID.
   */
  async getByUserId(userId: string): Promise<Wallet | null> {
    return await this.walletRepository.findByUserId(userId)
  }

  /**
   * Adjusts the balance of a wallet based on the provided command.
   *
   * @param {AdjustBalanceCommand} cmd - The command containing wallet ID and the balance adjustment delta.
   * @param {TransactionClientContract} [trx] - Optional transaction client for database operations.
   * @return {Promise<{ id: number; balance: number } | null>} A promise resolving to an object containing the wallet ID and updated balance, or null if the update fails.
   */
  async adjustBalance(
    cmd: AdjustBalanceCommand,
    trx?: TransactionClientContract
  ): Promise<{ id: number; balance: number } | null> {
    const updated = await this.walletRepository.adjustBalance(cmd.walletId, cmd.delta, trx)
    if (!updated) return null
    return { id: updated.id, balance: updated.balance ?? 0 }
  }
}
