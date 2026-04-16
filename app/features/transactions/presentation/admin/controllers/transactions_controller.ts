import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllTransactionsUseCase from '#features/transactions/application/use_cases/admin/get_all_transactions'
import GetTransactionDetailsUseCase from '#features/transactions/application/use_cases/admin/get_transaction_details'
import GetUserTransactionsStatsUseCase from '#features/transactions/application/use_cases/admin/get_user_transactions_stats'
import GetGlobalTransactionsStatsUseCase from '#features/transactions/application/use_cases/admin/get_global_transactions_stats'
import TransactionPolicy from '#features/transactions/presentation/admin/policies/transaction_policy'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#features/audit/domain/enums'

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
  async getAllTransactions({ request, response, bouncer, auth }: HttpContext): Promise<void> {
    await bouncer.with(TransactionPolicy).authorize('viewTransactions' as never)

    const page = request.input('page', 1)
    const perPage = request.input('perPage', 16)
    const type = request.input('type')
    const status = request.input('status')
    const search = request.input('search')
    const startDate = request.input('startDate')
    const endDate = request.input('endDate')
    const userId = request.input('userId', request.input('user_id'))

    const transactions = await this.getAllTransactionsUseCase.execute(page, perPage, {
      type,
      status,
      search,
      startDate,
      endDate,
      userId,
    })

    emitter.emit('activity:audit', {
      eventCategory: 'TRANSACTIONS',
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
  async findTransaction({ params, response, bouncer, auth, request }: HttpContext): Promise<void> {
    try {
      await bouncer.with(TransactionPolicy).authorize('viewTransaction' as never)

      const { reference } = params
      const loadLedger = await bouncer.with(TransactionPolicy).allows('viewLedger' as never)

      const transaction = await this.getTransactionDetailsUseCase.execute(reference, { loadLedger })

      emitter.emit('activity:audit', {
        eventCategory: 'TRANSACTIONS',
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

      return response.ok(transaction)
    } catch (error) {
      emitter.emit('activity:audit', {
        eventCategory: 'TRANSACTIONS',
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
  async getUserTransactions({
    params,
    request,
    response,
    bouncer,
    auth,
  }: HttpContext): Promise<void> {
    await bouncer.with(TransactionPolicy).authorize('viewUserTransactions' as never)

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
      eventCategory: 'TRANSACTIONS',
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
  async getTransactionsStats({ request, response, bouncer, auth }: HttpContext): Promise<void> {
    await bouncer.with(TransactionPolicy).authorize('viewTransactionsReport' as never)

    const startDate = request.input('startDate')
    const endDate = request.input('endDate')
    const stats = await this.getGlobalTransactionsStatsUseCase.execute(startDate, endDate)

    emitter.emit('activity:audit', {
      eventCategory: 'TRANSACTIONS',
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
  async getUserTransactionStats({
    params,
    request,
    response,
    bouncer,
    auth,
  }: HttpContext): Promise<void> {
    await bouncer.with(TransactionPolicy).authorize('viewUserTansactionsReport' as never)

    const { id } = params
    const startDate = request.input('startDate')
    const endDate = request.input('endDate')
    const stats = await this.getUserTransactionsStatsUseCase.execute(id, startDate, endDate)

    emitter.emit('activity:audit', {
      eventCategory: 'TRANSACTIONS',
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
