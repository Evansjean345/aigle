import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllLedgersUseCase from '#core/money/ledger/application/use_cases/get_all_ledgers'
import GetLedgerStatsUseCase from '#core/money/ledger/application/use_cases/get_ledger_stats'
import GetUserLedgerStatsUseCase from '#core/money/ledger/application/use_cases/get_user_ledger_stats'
import { LedgerOperationType } from '#core/money/ledger/domain/ledger_enums'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

@inject()
export default class LedgersController {
  /**
   * Initializes a new instance of the class with the provided use case dependencies.
   *
   * @param {GetAllLedgersUseCase} getAllLedgersUseCase - Use case for retrieving all ledgers.
   * @param {GetLedgerStatsUseCase} getLedgerStatsUseCase - Use case for retrieving ledger statistics.
   * @param {GetUserLedgerStatsUseCase} getUserLedgerStatsUseCase - Use case for retrieving user-specific ledger statistics.
   */
  constructor(
    private readonly getAllLedgersUseCase: GetAllLedgersUseCase,
    private readonly getLedgerStatsUseCase: GetLedgerStatsUseCase,
    private readonly getUserLedgerStatsUseCase: GetUserLedgerStatsUseCase
  ) {}

  /**
   * Handles an HTTP request to retrieve a paginated list of all ledger entries with filters.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async getAllLedgers({ request, response, auth }: HttpContext): Promise<void> {
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
    // Sert l'onglet grand livre d'une organisation : son portefeuille est rattaché par compte.
    const accountId = request.input('accountId', request.input('account_id'))

    const ledgers = await this.getAllLedgersUseCase.execute(page, perPage, {
      walletId,
      direction,
      operationType,
      startDate,
      endDate,
      search,
      userId,
      accountId,
    })

    emitter.emit('activity:audit', {
      eventCategory: 'LEDGERS',
      eventAction: 'READ_LEDGERS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: {
        page,
        perPage,
        walletId,
        direction,
        operationType,
        startDate,
        endDate,
        search,
        userId,
      },
      result: AuditResult.SUCCESS,
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
  async getLedgersStats({ request, response, auth }: HttpContext): Promise<void> {
    const walletId = request.input('wallet_id')
    // Sert les compteurs du grand livre d'une organisation, dont le portefeuille est rattaché par
    // compte et non par utilisateur.
    const accountId = request.input('accountId', request.input('account_id'))
    const period = request.input('period', '30d')
    const startDate = request.input('startDate', request.input('start_date'))
    const endDate = request.input('endDate', request.input('end_date'))

    const stats = await this.getLedgerStatsUseCase.execute({
      walletId,
      accountId,
      period,
      startDate,
      endDate,
    })

    emitter.emit('activity:audit', {
      eventCategory: 'LEDGERS',
      eventAction: 'READ_STATS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { walletId, period, startDate, endDate },
      result: AuditResult.SUCCESS,
    })

    return response.ok(stats)
  }

  // /**
  //  * Handles the request to generate and return chart data based on the provided parameters.
  //  *
  //  * @param {Object} HttpContext - The context object containing the request and response.
  //  * @param {Object} HttpContext.request - The HTTP request object.
  //  * @param {Object} HttpContext.response - The HTTP response object.
  //  * @return {Promise<void>} A promise that resolves with no return value, after sending chart data as a response.
  //  */
  // async chart({ request, response, auth }: HttpContext): Promise<void> {
  //   const walletId = request.input('wallet_id')
  //   const period = request.input('period', '30d')
  //   const groupBy = request.input('group_by', 'day')
  //
  //   const data = await this.getLedgerChartUseCase.execute({ walletId, period, groupBy })
  //
  //   emitter.emit('activity:audit', {
  //     eventCategory: 'LEDGERS',
  //     eventAction: 'READ_CHART',
  //     actorId: auth.user?.id ?? null,
  //     actorType: 'admin',
  //     actorRole: (auth.user as any)?.role?.slug ?? null,
  //     requestId: request.header('x-request-id') ?? null,
  //     ipAddress: request.ip(),
  //     userAgent: request.header('user-agent') ?? null,
  //     metadata: { walletId, period, groupBy },
  //     result: AuditResult.SUCCESS,
  //   })
  //
  //   return response.ok(data)
  // }

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
  async getUserLedgers({ params, request, response, auth }: HttpContext): Promise<void> {
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

    emitter.emit('activity:audit', {
      eventCategory: 'LEDGERS',
      eventAction: 'READ_USER_LEDGERS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      targetType: 'user',
      targetId: id,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { page, perPage, direction, operationType, startDate, endDate, search },
      result: AuditResult.SUCCESS,
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
  async getUserLedgerStats({ params, request, response, auth }: HttpContext): Promise<void> {
    const { id } = params // userId
    const period = request.input('period', '30d')
    const startDate = request.input('startDate', request.input('start_date'))
    const endDate = request.input('endDate', request.input('end_date'))

    const stats = await this.getUserLedgerStatsUseCase.execute(id, { period, startDate, endDate })

    if (!stats) {
      emitter.emit('activity:audit', {
        eventCategory: 'LEDGERS',
        eventAction: 'READ_USER_STATS',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'user',
        targetId: id,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        metadata: { period, startDate, endDate },
        result: AuditResult.FAILURE,
        errorMessage: 'User or wallet not found',
      })
      return response.notFound({ message: 'User or wallet not found' })
    }

    emitter.emit('activity:audit', {
      eventCategory: 'LEDGERS',
      eventAction: 'READ_USER_STATS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      targetType: 'user',
      targetId: id,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { period, startDate, endDate },
      result: AuditResult.SUCCESS,
    })

    return response.ok(stats)
  }

  // /**
  //  * Retrieves the user ledger chart data for a given user ID, period, and grouping option.
  //  *
  //  * @param {object} context - The HttpContext containing the request and response objects.
  //  * @param {object} context.params - The route parameters.
  //  * @param {string} context.params.id - The user ID.
  //  * @param {object} context.request - The HTTP request object.
  //  * @param {string} [context.request.input.period] - The time period for the ledger data, defaults to 30 days.
  //  * @param {string} [context.request.input.group_by] - The grouping factor for data aggregation, defaults to 'day'.
  //  * @param {object} context.response - The HTTP response object.
  //  * @return {Promise<void>} Resolves with a response containing chart data or an error message if not found.
  //  */
  // async getUserLedgerChart({ params, request, response, auth }: HttpContext): Promise<void> {
  //   const { id } = params // userId
  //   const period = request.input('period', '30d')
  //   const groupBy = request.input('group_by', 'day') as 'day' | 'week' | 'month'
  //
  //   const data = await this.getUserLedgerChartUseCase.execute(id, { period, groupBy })
  //
  //   if (!data) {
  //     emitter.emit('activity:audit', {
  //       eventCategory: 'LEDGERS',
  //       eventAction: 'READ_USER_CHART',
  //       actorId: auth.user?.id ?? null,
  //       actorType: 'admin',
  //       actorRole: (auth.user as any)?.role?.slug ?? null,
  //       targetType: 'user',
  //       targetId: id,
  //       requestId: request.header('x-request-id') ?? null,
  //       ipAddress: request.ip(),
  //       userAgent: request.header('user-agent') ?? null,
  //       metadata: { period, groupBy },
  //       result: AuditResult.FAILURE,
  //       errorMessage: 'User or wallet not found',
  //     })
  //     return response.notFound({ message: 'User or wallet not found' })
  //   }
  //
  //   emitter.emit('activity:audit', {
  //     eventCategory: 'LEDGERS',
  //     eventAction: 'READ_USER_CHART',
  //     actorId: auth.user?.id ?? null,
  //     actorType: 'admin',
  //     actorRole: (auth.user as any)?.role?.slug ?? null,
  //     targetType: 'user',
  //     targetId: id,
  //     requestId: request.header('x-request-id') ?? null,
  //     ipAddress: request.ip(),
  //     userAgent: request.header('user-agent') ?? null,
  //     metadata: { period, groupBy },
  //     result: AuditResult.SUCCESS,
  //   })
  //
  //   return response.ok(data)
  // }
}
