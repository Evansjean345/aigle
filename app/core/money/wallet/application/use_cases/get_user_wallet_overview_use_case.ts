import UserRepository from '#core/identity/user/domain/interfaces/user_repository'
import WalletService from '#core/money/wallet/application/services/wallet_service'
import {
  toWalletOverviewResult,
  type WalletOverviewResult,
} from '#core/money/wallet/application/dtos/wallet.dto'
import { inject } from '@adonisjs/core'
import TransactionRepository from '#core/money/transactions/domain/interfaces/transaction_repository'
import UserAccountNotFoundException from '#core/identity/authentication/domain/exceptions/user_account_not_found_exception'

@inject()
export default class GetUserWalletOverviewUseCase {
  /**
   * Creates an instance of the class with the specified dependencies.
   *
   * @param {WalletService} walletService - Service responsible for wallet operations.
   * @param {UserRepository} userRepository - Repository for managing user data persistently.
   * @param transactionRepository
   */
  constructor(
    private readonly walletService: WalletService,
    private readonly userRepository: UserRepository,
    private readonly transactionRepository: TransactionRepository
  ) {}

  /**
   * Retrieves the wallet overview for a given user.
   *
   * @param {string} userId - The unique identifier of the user.
   * @return {Promise<WalletOverviewResult>} A promise that resolves to the wallet overview result.
   * @throws {UserAccountNotFoundException} If the user is not found or the corresponding wallet does not exist.
   */
  async execute(userId: string): Promise<WalletOverviewResult> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new UserAccountNotFoundException()
    }

    const wallet = await this.walletService.getByUserId(user.usersUid)
    const latestTransactions = await this.transactionRepository.getLatestTransactionByUserId(
      user.usersUid,
      9
    )

    return toWalletOverviewResult(wallet, latestTransactions)
  }
}
