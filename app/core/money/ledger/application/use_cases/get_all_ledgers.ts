import { inject } from '@adonisjs/core'
import LedgerRepository from '#core/money/ledger/domain/interfaces/ledger_repository'
import AccountHolderResolver from '#core/money/transactions/application/services/account_holder_resolver'
import { LedgerDto } from '#core/money/ledger/application/dto/ledger.dto'
import { LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'

@inject()
export default class GetAllLedgersUseCase {
  /**
   * @param {LedgerRepository} ledgerRepository - The repository used to manage ledger data.
   * @param {AccountHolderResolver} holderResolver - Résout les titulaires par `account_id`
   *   (account-centric : wallet → account → owner, user ou marchand).
   */
  constructor(
    private readonly ledgerRepository: LedgerRepository,
    private readonly holderResolver: AccountHolderResolver
  ) {}

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
   * @param {Object} [sort] - Ordre demandé. Sans `sortBy`, l'ordre par défaut du dépôt.
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
      search?: string
      userId?: string
      accountId?: string
    },
    sort?: { sortBy?: string; order?: 'asc' | 'desc' }
  ): Promise<{ meta: any; data: LedgerDto[] }> {
    const paginatedLedgers = await this.ledgerRepository.findAll(page, perPage, filters, sort)
    const ledgers = paginatedLedgers.all()

    const holders = await this.holderResolver.resolve(
      ledgers.map((ledger) => ledger.wallet?.accountId)
    )

    const data = ledgers.map((ledger) => LedgerDto.fromLedger(ledger, holders))

    return {
      meta: paginatedLedgers.getMeta(),
      data: data,
    }
  }
}
