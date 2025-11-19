import UserRepository from '#features/authentication/domain/interfaces/user_repository'
import { Exception } from '@adonisjs/core/exceptions'
import WalletService from '#mobile/wallet/services/wallet_service'
import { toWalletOverviewResult } from '#mobile/wallet/mappers/wallet.mapper'
import { WalletOverviewResult } from '#mobile/wallet/dtos/wallet_overview.result'
import { inject } from '@adonisjs/core'
import TransactionRepository from '#features/transactions/domain/interfaces/transaction_repository'

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
   * @throws {Exception} If the user is not found or the corresponding wallet does not exist.
   */
  async execute(userId: string): Promise<WalletOverviewResult> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new Exception('User not found', {
        status: 404,
        code: 'USER_NOT_FOUND',
      })
    }

    const wallet = await this.walletService.getByUserId(user.usersUid)
    const latestTransactions = await this.transactionRepository.getLatestTransactionByUserId(
      user.usersUid,
      9
    )

    return toWalletOverviewResult(wallet, latestTransactions)
  }
}
