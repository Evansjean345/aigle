import { inject } from '@adonisjs/core'
import UserRepository from '#core/user/domain/interfaces/user_repository'
import TransactionVolumeCache from '#core/transactions/domain/interfaces/transaction_volume_cache'
import { Exception } from '@adonisjs/core/exceptions'
import { AdminUserWalletStatsDto } from '#core/user/application/dtos/admin_user_wallet_stats_dto'
import TransactionRepository from '#core/transactions/domain/interfaces/transaction_repository'

@inject()
export default class GetUserWalletStatsUseCase {
  /**
   * Creates an instance of the class.
   *
   * @param {UserRepository} userRepository - Repository for managing user data.
   * @param {TransactionVolumeCache} transactionVolumeCache - Cache for storing transaction volume data.
   * @param {TransactionRepository} transactionRepository - Repository for handling transaction data.
   */
  constructor(
    private readonly userRepository: UserRepository,
    private readonly transactionVolumeCache: TransactionVolumeCache,
    private readonly transactionRepository: TransactionRepository
  ) {}

  /**
   * Executes the process to retrieve the admin user's wallet statistics, including wallet details,
   * KYC limits, and transaction activity data such as daily and monthly volume, and the latest transaction.
   *
   * @param {string} userId - The unique identifier of the user whose wallet stats are to be retrieved.
   * @return {Promise<AdminUserWalletStatsDto>} A promise that resolves to an object containing the wallet details,
   *         activity statistics, and KYC limits for the specified user.
   * @throws {Exception} Throws an exception if the user is not found or if wallet or KYC data is missing.
   */
  async execute(userId: string): Promise<AdminUserWalletStatsDto> {
    const user = await this.userRepository.findById(userId)

    if (!user) {
      throw new Exception('Utilisateur non trouvé', { status: 404 })
    }

    // Charger les relations nécessaires
    await Promise.all([user.load('wallet'), user.load('keyLevel')])

    const wallet = user.wallet
    const kycLevel = user.keyLevel

    if (!wallet || !kycLevel) {
      throw new Exception('Données de portefeuille ou de limites KYC manquantes', { status: 404 })
    }

    // Récupération des volumes depuis le cache Redis
    const [todayVolume, monthVolume] = await Promise.all([
      this.transactionVolumeCache.getDailyVolume(user.usersUid),
      this.transactionVolumeCache.getMonthlyVolume(user.usersUid),
    ])

    const today = new Date().toISOString().split('T')[0]

    const [todayTxCount, lastTx] = await Promise.all([
      this.transactionRepository.countSuccessByDate(user.usersUid, today),
      this.transactionRepository.findLastSuccessByUserId(user.usersUid),
    ])

    return {
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        currency: wallet.currencySymbol || 'FCFA',
        status: wallet.status,
        limitPerTransaction: kycLevel.singleLimit,
        limitDaily: kycLevel.dailyLimit,
        limitMonthly: kycLevel.monthlyLimit,
        balanceLimit: kycLevel.balanceLimit,
      },
      activity: {
        todayTxCount: todayTxCount,
        todayVolume: todayVolume,
        monthVolume: monthVolume,
        lastTxDate: lastTx ? lastTx.createdAt.toISO() : null,
        lastTxAmount: lastTx ? lastTx.amount : null,
      },
    }
  }
}
