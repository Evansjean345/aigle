import { inject } from '@adonisjs/core'
import LedgerRepository from '#features/ledger/domain/interfaces/ledger_repository'
import LedgerMapper from '#features/ledger/application/mapper/ledger.mapper'
import { LedgerDto } from '#features/ledger/application/dto/ledger.dto'
import { LedgerOperationType } from '#features/ledger/domain/ledger_enums'

@inject()
export default class GetAllLedgersUseCase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  /**
   * Executes a query to fetch paginated ledger data with optional filters.
   *
   * @param {number} page - The current page number for pagination.
   * @param {number} perPage - The number of items to include per page.
   * @param {Object} [filters] - Optional filters to narrow the query results.
   * @param {number} [filters.walletId] - Filter by wallet ID.
   * @param {string} [filters.direction] - Filter by transaction direction (e.g., "inbound" or "outbound").
   * @param {string} [filters.startDate] - Filter transactions starting from a specific date (ISO 8601 format).
   * @param {string} [filters.endDate] - Filter transactions up to a specific date (ISO 8601 format).
   *
   * @return {Promise<{ meta: any; data: LedgerDto[] }>} A promise that resolves to an object containing pagination metadata and a list of ledger data in DTO format.
   */
  async execute(
    page: number,
    perPage: number,
    filters?: {
      walletId?: number
      direction?: string
      operationType?: LedgerOperationType | string
      startDate?: string
      endDate?: string
    }
  ): Promise<{ meta: any; data: LedgerDto[] }> {
    const paginatedLedgers = await this.ledgerRepository.findAll(page, perPage, filters)
    const data = LedgerMapper.toDtoList(paginatedLedgers.all())

    return {
      meta: paginatedLedgers.getMeta(),
      data: data,
    }
  }
}
