import { inject } from '@adonisjs/core'
import LedgerRepository from '#features/ledger/domain/interfaces/ledger_repository'
import WalletRepository from '#features/wallet/domain/interfaces/wallet_repository'

@inject()
export default class GetUserLedgerStatsUseCase {
  /**
   * Constructs an instance of the class with the provided repositories.
   *
   * @param {LedgerRepository} ledgerRepository - The repository for interacting with ledger data.
   * @param {WalletRepository} walletRepository - The repository for managing wallet data.
   */
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly walletRepository: WalletRepository
  ) {}

  /**
   * Executes the use case to retrieve ledger statistics for a specific user.
   *
   * @param {string} userId - The unique identifier of the user.
   * @param {object} filters - Additional filtering criteria for statistics.
   * @return {Promise<any | null>} A promise that resolves to ledger statistics or null if no wallet found.
   */
  async execute(
    userId: string,
    filters: { period?: string; startDate?: string; endDate?: string }
  ): Promise<any | null> {
    const wallet = await this.walletRepository.findByUserId(userId)
    if (!wallet) {
      return null
    }

    return await this.ledgerRepository.getStats({
      ...filters,
      walletId: wallet.id,
    })
  }
}
