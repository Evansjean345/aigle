import TransactionRepository from '#features/transactions/domain/interfaces/transaction_repository'
import { inject } from '@adonisjs/core'
import { UserTransactionsStatsDTO } from '#features/transactions/application/dto/admin_transaction.dto'

@inject()
export default class GetGlobalTransactionsStatsUseCase {
  /**
   * Initializes a new instance of the class with the specified transactions' repository.
   *
   * @param {TransactionRepository} transactionsRepository - The repository that handles transaction data.
   */
  constructor(private readonly transactionsRepository: TransactionRepository) {}

  /**
   * Retrieves and calculates statistical data related to all transactions.
   *
   * @param {string} [startDate] - Optional start date filter.
   * @param {string} [endDate] - Optional end date filter.
   * @return {Promise<UserTransactionsStatsDTO>} A promise that resolves to an object containing statistics about the transactions, including total volumes, counts, rates, and average transaction value.
   */
  async execute(startDate?: string, endDate?: string): Promise<UserTransactionsStatsDTO> {
    const stats = await this.transactionsRepository.getStats({ startDate, endDate })

    return {
      totalInVolume: stats.totalIn,
      totalOutVolume: stats.totalOut,
      transferVolume: stats.transferVolume,
      interNetworkVolume: stats.interNetworkVolume,
      walletTransferVolume: stats.walletTransferVolume,
      totalFees: stats.totalFees,
      totalCount: stats.count,
      successCount: stats.successCount,
      failedCount: stats.failedCount,
      pendingCount: stats.pendingCount,
      successRate: stats.count > 0 ? (stats.successCount / stats.count) * 100 : 0,
      failureRate: stats.count > 0 ? (stats.failedCount / stats.count) * 100 : 0,
      avgTransactionValue:
        stats.successCount > 0 ? (stats.totalIn + stats.totalOut) / stats.successCount : 0,
    }
  }
}
