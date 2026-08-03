import { HttpContext } from '@adonisjs/core/http'
import type Admin from '#core/team/domain/models/admin'
import { adminHasPermission } from '#core/team/application/authorization/permission_helpers'
import { TRANSACTION_PERMISSIONS } from '#core/money/transactions/presentation/admin/permissions.config'
import { inject } from '@adonisjs/core'
import GetAllTransactionsUseCase from '#core/money/transactions/application/use_cases/admin/get_all_transactions'
import GetTransactionDetailsUseCase from '#core/money/transactions/application/use_cases/admin/get_transaction_details'
import GetUserTransactionsStatsUseCase from '#core/money/transactions/application/use_cases/admin/get_user_transactions_stats'
import GetGlobalTransactionsStatsUseCase from '#core/money/transactions/application/use_cases/admin/get_global_transactions_stats'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'

/**
 * A controller responsible for managing transaction-related operations such as fetching transactions,
 * viewing transaction details, and retrieving transaction statistics.
 */
@inject()
export default class TransactionsController {
  /**
   * Initializes a new instance of the class with a dependency for retrieving transactions.
   *
   * @param {GetAllTransactionsUseCase} getAllTransactionsUseCase - The use case responsible for fetching all transactions.
   * @param {GetTransactionDetailsUseCase} getTransactionDetailsUseCase - The use case responsible for fetching transaction details.
   * @param {GetUserTransactionsStatsUseCase} getUserTransactionsStatsUseCase
   * @param {GetGlobalTransactionsStatsUseCase} getGlobalTransactionsStatsUseCase
   */
  constructor(
    private readonly getAllTransactionsUseCase: GetAllTransactionsUseCase,
    private readonly getTransactionDetailsUseCase: GetTransactionDetailsUseCase,
    private readonly getUserTransactionsStatsUseCase: GetUserTransactionsStatsUseCase,
    private readonly getGlobalTransactionsStatsUseCase: GetGlobalTransactionsStatsUseCase
  ) {}

  /**
   * Handles an HTTP request and performs actions to return a response.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async getAllTransactions({ request, response, auth }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 16)
    const type = request.input('type')
    const status = request.input('status')
    const search = request.input('search')
    const startDate = request.input('startDate')
    const endDate = request.input('endDate')
    const userId = request.input('userId', request.input('user_id'))
    // Sert l'onglet transactions d'une organisation : `account_id == organisationId`.
    const accountId = request.input('accountId', request.input('account_id'))

    const transactions = await this.getAllTransactionsUseCase.execute(page, perPage, {
      type,
      status,
      search,
      startDate,
      endDate,
      userId,
      accountId,
    })

    emitter
      .emit('activity:audit', {
        eventCategory: 'TRANSACTION',
        eventAction: 'READ_TRANSACTIONS',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        metadata: { page, perPage, type, status, search, startDate, endDate, userId },
        result: AuditResult.SUCCESS,
      })
      .catch(() => {})

    return response.ok(transactions)
  }

  /**
   * Handles an HTTP request to retrieve a single transaction by its identifier or reference.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @param {object} context.params - The request parameters.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async findTransaction({ params, response, auth, request }: HttpContext): Promise<void> {
    try {
      const { reference } = params
      const loadLedger = await adminHasPermission(
        auth.user as Admin,
        TRANSACTION_PERMISSIONS.ledger
      )

      const transaction = await this.getTransactionDetailsUseCase.execute(reference, { loadLedger })

      emitter
        .emit('activity:audit', {
          eventCategory: 'TRANSACTION',
          eventAction: 'VIEW_TRANSACTION_DETAILS',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'transaction',
          targetId: reference,
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          result: AuditResult.SUCCESS,
        })
        .catch(() => {})

      return response.ok(transaction)
    } catch (error) {
      emitter
        .emit('activity:audit', {
          eventCategory: 'TRANSACTION',
          eventAction: 'VIEW_TRANSACTION_DETAILS',
          actorId: auth.user?.id ?? null,
          actorType: 'admin',
          actorRole: (auth.user as any)?.role?.slug ?? null,
          targetType: 'transaction',
          targetId: params.reference,
          requestId: request.header('x-request-id') ?? null,
          ipAddress: request.ip(),
          userAgent: request.header('user-agent') ?? null,
          result: AuditResult.FAILURE,
          errorMessage: (error as Error)?.message ?? 'Transaction not found',
        })
        .catch(() => {})
      throw error
    }
  }

  /**
   * Handles the retrieval of a user's transactions based on provided parameters.
   *
   * @param {Object} HttpContext - The context object for the HTTP request/response.
   * @param {Object} HttpContext.params - The parameters extracted from the request.
   * @param {string} HttpContext.params.userId - The unique identifier of the user.
   * @param {Object} HttpContext.request - The HTTP request instance.
   * @param {Function} HttpContext.request.input - A method to retrieve request input values.
   * @param {number} HttpContext.request.input.page - The current page number for pagination (default is 1).
   * @param {number} HttpContext.request.input.perPage - The number of items per page for pagination (default is 16).
   * @param {Object} HttpContext.response - The HTTP response instance, used to send responses back to the client.
   * @return {Promise<void>} Resolves when the user's transactions are successfully retrieved and sent in the response.
   */
  async getUserTransactions({ params, request, response, auth }: HttpContext): Promise<void> {
    const { id } = params
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 16)
    const type = request.input('type')
    const status = request.input('status')
    const search = request.input('search')
    const startDate = request.input('startDate')
    const endDate = request.input('endDate')

    const transactions = await this.getAllTransactionsUseCase.execute(page, perPage, {
      type,
      status,
      search,
      startDate,
      endDate,
      userId: id,
    })

    emitter.emit('activity:audit', {
      eventCategory: 'TRANSACTION',
      eventAction: 'READ_USER_TRANSACTIONS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { page, perPage, type, status, search, startDate, endDate, userId: id },
      result: AuditResult.SUCCESS,
    })

    return response.ok(transactions)
  }

  /**
   * Retrieves global transaction statistics.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async getTransactionsStats({ request, response, auth }: HttpContext): Promise<void> {
    const startDate = request.input('startDate')
    const endDate = request.input('endDate')
    // Sert le bandeau de l'onglet transactions d'une organisation.
    const accountId = request.input('accountId', request.input('account_id'))
    const stats = await this.getGlobalTransactionsStatsUseCase.execute(
      startDate,
      endDate,
      accountId
    )

    emitter.emit('activity:audit', {
      eventCategory: 'TRANSACTION',
      eventAction: 'READ_GLOBAL_STATS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { startDate, endDate },
      result: AuditResult.SUCCESS,
    })

    return response.ok(stats)
  }

  /**
   * Retrieves transaction statistics for a specific user.
   *
   * @param {HttpContext} context - The context object containing the HTTP request and response.
   * @param {object} context.params - The request parameters.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the method completes.
   */
  async getUserTransactionStats({ params, request, response, auth }: HttpContext): Promise<void> {
    const { id } = params
    const startDate = request.input('startDate')
    const endDate = request.input('endDate')
    const stats = await this.getUserTransactionsStatsUseCase.execute(id, startDate, endDate)

    emitter.emit('activity:audit', {
      eventCategory: 'TRANSACTION',
      eventAction: 'READ_USER_STATS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { startDate, endDate, userId: id },
      result: AuditResult.SUCCESS,
    })

    return response.ok(stats)
  }
}
