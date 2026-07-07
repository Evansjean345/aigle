import { inject } from '@adonisjs/core'
import LedgerRepository from '#core/money/ledger/domain/interfaces/ledger_repository'
import WalletRepository from '#core/money/wallet/domain/interfaces/wallet_repository'

@inject()
export default class GetUserLedgerChartUseCase {
  /**
   * Constructs an instance of the class with the specified repositories.
   *
   * @param {LedgerRepository} ledgerRepository - The repository for managing ledger data.
   * @param {WalletRepository} walletRepository - The repository for managing wallet data.
   */
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly walletRepository: WalletRepository
  ) {}

  /**
   * Executes the use case to retrieve ledger chart data for a specific user.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {object} filters - Filtering criteria for chart data.
   * @return {Promise<any[] | null>} A promise that resolves to chart data or null if no wallet found.
   */
  async execute(
    userId: string,
    filters: {
      period?: string
      groupBy?: 'day' | 'week' | 'month'
    }
  ): Promise<any[] | null> {
    const wallet = await this.walletRepository.findByUserId(userId)
    if (!wallet) {
      return null
    }

    return await this.ledgerRepository.getChartData({
      ...filters,
      walletId: wallet.id,
    })
  }
}
