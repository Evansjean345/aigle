import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllLedgersUseCase from '#features/ledger/application/use_cases/get_all_ledgers'
import GetLedgerStatsUseCase from '#features/ledger/application/use_cases/get_ledger_stats'
import GetLedgerChartUseCase from '#features/ledger/application/use_cases/get_ledger_chart'
import { LedgerOperationType } from '#features/ledger/domain/ledger_enums'

@inject()
export default class LedgersController {
  constructor(
    private readonly getAllLedgersUseCase: GetAllLedgersUseCase,
    private readonly getLedgerStatsUseCase: GetLedgerStatsUseCase,
    private readonly getLedgerChartUseCase: GetLedgerChartUseCase
  ) {}

  /**
   * Handles an HTTP request to retrieve a paginated list of all ledger entries with filters.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('limit', request.input('perPage', 20))
    const walletId = request.input('wallet_id')
    const direction = request.input('direction')
    const operationType = request.input('operation_type') as LedgerOperationType
    const startDate = request.input('start_date')
    const endDate = request.input('end_date')

    const ledgers = await this.getAllLedgersUseCase.execute(page, perPage, {
      walletId,
      direction,
      operationType,
      startDate,
      endDate,
    })
    return response.ok(ledgers)
  }

  /**
   * Global statistics for the dashboard.
   */
  async stats({ request, response }: HttpContext): Promise<void> {
    const walletId = request.input('wallet_id')
    const period = request.input('period', '30d')

    const stats = await this.getLedgerStatsUseCase.execute({ walletId, period })
    return response.ok(stats)
  }

  /**
   * Data for the evolution chart.
   */
  async chart({ request, response }: HttpContext): Promise<void> {
    const walletId = request.input('wallet_id')
    const period = request.input('period', '30d')
    const groupBy = request.input('group_by', 'day')

    const data = await this.getLedgerChartUseCase.execute({ walletId, period, groupBy })
    return response.ok(data)
  }
}
