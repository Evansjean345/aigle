import { inject } from '@adonisjs/core'
import LedgerRepository from '#core/ledger/domain/interfaces/ledger_repository'

@inject()
export default class GetLedgerStatsUseCase {
  /**
   * Constructs an instance of the class with the provided ledger repository.
   *
   * @param {LedgerRepository} ledgerRepository - The repository responsible for managing ledger interactions.
   */
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  /**
   * Executes the use case to retrieve ledger statistics.
   *
   * @param {object} filters - Filtering criteria for statistics.
   * @return {Promise<any>} A promise that resolves to ledger statistics.
   */
  async execute(filters: {
    walletId?: number
    period?: string
    startDate?: string
    endDate?: string
  }): Promise<any> {
    return await this.ledgerRepository.getStats(filters)
  }
}
