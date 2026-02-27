import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllLedgersUseCase from '#features/ledger/application/use_cases/get_all_ledgers'
import GetLedgerStatsUseCase from '#features/ledger/application/use_cases/get_ledger_stats'
import GetLedgerChartUseCase from '#features/ledger/application/use_cases/get_ledger_chart'
import GetUserLedgersUseCase from '#features/ledger/application/use_cases/get_user_ledgers'
import GetUserLedgerStatsUseCase from '#features/ledger/application/use_cases/get_user_ledger_stats'
import GetUserLedgerChartUseCase from '#features/ledger/application/use_cases/get_user_ledger_chart'
import { LedgerOperationType } from '#features/ledger/domain/ledger_enums'

@inject()
export default class LedgersController {
  /**
   * Initializes a new instance of the class with the provided use case dependencies.
   *
   * @param {GetAllLedgersUseCase} getAllLedgersUseCase - Use case for retrieving all ledgers.
   * @param {GetLedgerStatsUseCase} getLedgerStatsUseCase - Use case for retrieving ledger statistics.
   * @param {GetLedgerChartUseCase} getLedgerChartUseCase - Use case for retrieving ledger chart data.
   * @param {GetUserLedgersUseCase} getUserLedgersUseCase - Use case for retrieving user-specific ledgers.
   * @param {GetUserLedgerStatsUseCase} getUserLedgerStatsUseCase - Use case for retrieving user-specific ledger statistics.
   * @param {GetUserLedgerChartUseCase} getUserLedgerChartUseCase - Use case for retrieving user-specific ledger chart data.
   */
  constructor(
    private readonly getAllLedgersUseCase: GetAllLedgersUseCase,
    private readonly getLedgerStatsUseCase: GetLedgerStatsUseCase,
    private readonly getLedgerChartUseCase: GetLedgerChartUseCase,
    private readonly getUserLedgersUseCase: GetUserLedgersUseCase,
    private readonly getUserLedgerStatsUseCase: GetUserLedgerStatsUseCase,
    private readonly getUserLedgerChartUseCase: GetUserLedgerChartUseCase
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
    const operationType = request.input('operationType', request.input('operation_type')) as
      | LedgerOperationType
      | string
    const startDate = request.input('startDate', request.input('start_date'))
    const endDate = request.input('endDate', request.input('end_date'))
    const search = request.input('search')
    const userId = request.input('userId', request.input('user_id'))

    const ledgers = await this.getAllLedgersUseCase.execute(page, perPage, {
      walletId,
      direction,
      operationType,
      startDate,
      endDate,
      search,
      userId,
    })
    return response.ok(ledgers)
  }

  /**
   * Handles the retrieval of ledger statistics for a given wallet and period.
   *
   * @param {object} HttpContext - The context object containing the request and response.
   * @param {object} HttpContext.request - The HTTP request object.
   * @param {object} HttpContext.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the response is sent.
   */
  async stats({ request, response }: HttpContext): Promise<void> {
    const walletId = request.input('wallet_id')
    const period = request.input('period', '30d')
    const startDate = request.input('startDate', request.input('start_date'))
    const endDate = request.input('endDate', request.input('end_date'))

    const stats = await this.getLedgerStatsUseCase.execute({ walletId, period, startDate, endDate })
    return response.ok(stats)
  }

  /**
   * Handles the request to generate and return chart data based on the provided parameters.
   *
   * @param {Object} HttpContext - The context object containing the request and response.
   * @param {Object} HttpContext.request - The HTTP request object.
   * @param {Object} HttpContext.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves with no return value, after sending chart data as a response.
   */
  async chart({ request, response }: HttpContext): Promise<void> {
    const walletId = request.input('wallet_id')
    const period = request.input('period', '30d')
    const groupBy = request.input('group_by', 'day')

    const data = await this.getLedgerChartUseCase.execute({ walletId, period, groupBy })
    return response.ok(data)
  }

  /**
   * Fetches the user ledger records based on the provided parameters.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - Parameters from the request route.
   * @param {string} context.params.id - The ID of the user.
   * @param {Object} context.request - The request object containing input data.
   * @param {number} context.request.input.page - The current page number (default is 1).
   * @param {number} context.request.input.perPage - Number of records per page (default is 20).
   * @param {string} [context.request.input.direction] - The transaction direction (e.g., 'inflow', 'outflow').
   * @param {string} [context.request.input.operation_type] - The type of operation (e.g., 'deposit', 'withdrawal').
   * @param {string} [context.request.input.start_date] - The start date filter for the ledger records.
   * @param {string} [context.request.input.end_date] - The end date filter for the ledger records.
   * @param {Object} context.response - The response object used to send the output.
   *
   * @return {Promise<void>} Resolves when the ledger records have been retrieved and the response is sent.
   */
  async getUserLedgers({ params, request, response }: HttpContext): Promise<void> {
    const { id } = params // userId
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 20)
    const direction = request.input('direction')
    const operationType = request.input('operationType', request.input('operation_type')) as
      | LedgerOperationType
      | string
    const startDate = request.input('startDate', request.input('start_date'))
    const endDate = request.input('endDate', request.input('end_date'))
    const search = request.input('search')

    const result = await this.getAllLedgersUseCase.execute(page, perPage, {
      direction,
      operationType,
      startDate,
      endDate,
      search,
      userId: id,
    })

    return response.ok(result)
  }

  /**
   * Retrieves the ledger statistics for a specific user within a specified time period.
   *
   * @param {Object} context - The HTTP context containing request and response objects.
   * @param {Object} context.params - The route parameters, including the user ID.
   * @param {Object} context.request - The HTTP request object, used to retrieve query parameters.
   * @param {Object} context.response - The HTTP response object, used to send responses back to the client.
   * @return {Promise<void>} A promise that resolves when the ledger statistics have been retrieved and a response has been sent.
   */
  async getUserLedgerStats({ params, request, response }: HttpContext): Promise<void> {
    const { id } = params // userId
    const period = request.input('period', '30d')
    const startDate = request.input('startDate', request.input('start_date'))
    const endDate = request.input('endDate', request.input('end_date'))

    const stats = await this.getUserLedgerStatsUseCase.execute(id, { period, startDate, endDate })

    if (!stats) {
      return response.notFound({ message: 'User or wallet not found' })
    }

    return response.ok(stats)
  }

  /**
   * Retrieves the user ledger chart data for a given user ID, period, and grouping option.
   *
   * @param {object} context - The HttpContext containing the request and response objects.
   * @param {object} context.params - The route parameters.
   * @param {string} context.params.id - The user ID.
   * @param {object} context.request - The HTTP request object.
   * @param {string} [context.request.input.period] - The time period for the ledger data, defaults to 30 days.
   * @param {string} [context.request.input.group_by] - The grouping factor for data aggregation, defaults to 'day'.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} Resolves with a response containing chart data or an error message if not found.
   */
  async getUserLedgerChart({ params, request, response }: HttpContext): Promise<void> {
    const { id } = params // userId
    const period = request.input('period', '30d')
    const groupBy = request.input('group_by', 'day') as 'day' | 'week' | 'month'

    const data = await this.getUserLedgerChartUseCase.execute(id, { period, groupBy })

    if (!data) {
      return response.notFound({ message: 'User or wallet not found' })
    }

    return response.ok(data)
  }
}
