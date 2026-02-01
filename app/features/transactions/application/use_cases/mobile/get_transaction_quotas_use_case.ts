import { inject } from '@adonisjs/core'
import User from '#features/user/domain/models/user'
import TransactionVolumeCache from '#features/transactions/domain/interfaces/transaction_volume_cache'
import { TransactionQuotasResult } from '#features/transactions/application/dtos/transaction_quotas_result'
import { Exception } from '@adonisjs/core/exceptions'

@inject()
export default class GetTransactionQuotasUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {TransactionVolumeCache} transactionVolumeCache - The cache instance used to store and retrieve transaction volume data.
   */
  constructor(private readonly transactionVolumeCache: TransactionVolumeCache) {}

  /**
   * Executes the operation to fetch and calculate transaction quotas for a given user.
   *
   * @param {User} user The user for whom the transaction quotas are to be calculated.
   *                    The user object should contain or be able to load keyLevel and wallet information.
   * @return {Promise<TransactionQuotasResult>} A promise that resolves to an object containing the user's transaction quotas,
   *                                            including daily, monthly, wallet, and single transaction limits.
   * @throws {Exception} Throws an exception if the user's KYC level (keyLevel) or wallet is not found.
   */
  async execute(user: User): Promise<TransactionQuotasResult> {
    if (!user.keyLevel) {
      await user.load('keyLevel')
    }

    if (!user.keyLevel) {
      throw new Exception('Niveau KYC non trouvé pour cet utilisateur.', {
        status: 404,
        code: 'KYC_LEVEL_NOT_FOUND',
      })
    }

    if (!user.wallet) {
      await user.load('wallet')
    }

    if (!user.wallet) {
      throw new Exception('Portefeuille non trouvé pour cet utilisateur.', {
        status: 404,
        code: 'WALLET_NOT_FOUND',
      })
    }

    const limits = user.keyLevel
    const wallet = user.wallet
    const userId = user.usersUid

    const [dailyConsumed, monthlyConsumed] = await Promise.all([
      this.transactionVolumeCache.getDailyVolume(userId),
      this.transactionVolumeCache.getMonthlyVolume(userId),
    ])

    const dailyRemaining = Math.max(0, limits.dailyLimit - dailyConsumed)
    const monthlyRemaining = Math.max(0, limits.monthlyLimit - monthlyConsumed)
    const walletRemainingCapacity = Math.max(0, limits.balanceLimit - wallet.balance)

    return {
      daily: {
        consumed: dailyConsumed,
        limit: limits.dailyLimit,
        remaining: dailyRemaining,
      },
      monthly: {
        consumed: monthlyConsumed,
        limit: limits.monthlyLimit,
        remaining: monthlyRemaining,
      },
      wallet: {
        currentBalance: Number(wallet.balance),
        limit: limits.balanceLimit,
        remainingCapacity: walletRemainingCapacity,
      },
      singleTransaction: {
        limit: limits.singleLimit,
      },
      kycLevel: limits.level,
    }
  }
}
