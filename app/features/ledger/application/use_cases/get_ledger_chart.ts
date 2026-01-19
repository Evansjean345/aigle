import { inject } from '@adonisjs/core'
import LedgerRepository from '#features/ledger/domain/interfaces/ledger_repository'

@inject()
export default class GetLedgerChartUseCase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  /**
   * Executes the use case to retrieve ledger chart data.
   *
   * @param {object} filters - Filtering criteria for chart data.
   * @return {Promise<any[]>} A promise that resolves to chart data.
   */
  async execute(filters: {
    walletId?: number
    period?: string
    groupBy?: 'day' | 'week' | 'month'
  }): Promise<any[]> {
    const data = await this.ledgerRepository.getChartData(filters)
    console.log('Ledger chart data:', data)
    return data
  }
}
