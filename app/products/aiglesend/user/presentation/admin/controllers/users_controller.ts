import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllUsersUseCase from '#aiglesend/user/application/use_cases/admin/get_all_users_use_case'
import GetUserWalletStatsUseCase from '#aiglesend/user/application/use_cases/admin/get_user_wallet_stats_use_case'
import GetAdminUserDetailsUseCase from '#aiglesend/user/application/use_cases/admin/get_admin_user_details_use_case'
import ChangeUserStateUseCase from '#aiglesend/user/application/use_cases/admin/change_user_state_use_case'
import GetUserStatsUseCase from '#aiglesend/user/application/use_cases/admin/get_user_stats_use_case'
import SearchUserUseCase from '#aiglesend/user/application/use_cases/admin/search_user_use_case'

import { UserStatus } from '#core/identity/user/domain/enum'
import emitter from '@adonisjs/core/services/emitter'
import { AuditResult } from '#core/audit/domain/enums'
import Admin from '#core/team/domain/models/admin'

@inject()
export default class UsersController {
  /**
   * Initializes a new instance of the class.
   *
   * @param {GetAllUsersUseCase} getAllUsersUseCase - An instance of GetAllUsersUseCase used to retrieve all users.
   * @param {GetUserWalletStatsUseCase} getUserWalletStatsUseCase
   * @param {GetAdminUserDetailsUseCase} getAdminUserDetailsUseCase
   * @param {ChangeUserStateUseCase} changeUserStateUseCase
   * @param {GetUserStatsUseCase} getUserStatsUseCase
   * @param {SearchUserUseCase} searchUserUseCase - An instance of SearchUserUseCase used to search for users by name.
   */
  constructor(
    private readonly getAllUsersUseCase: GetAllUsersUseCase,
    private readonly getUserWalletStatsUseCase: GetUserWalletStatsUseCase,
    private readonly getAdminUserDetailsUseCase: GetAdminUserDetailsUseCase,
    private readonly changeUserStateUseCase: ChangeUserStateUseCase,
    private readonly getUserStatsUseCase: GetUserStatsUseCase,
    private readonly searchUserUseCase: SearchUserUseCase
  ) {}

  /**
   * Handles the index request and responds with a standard message.
   *
   * @param {Object} HttpContext - An object containing the request and response.
   * @param {Object} HttpContext.request - The incoming HTTP request object.
   * @param {Object} HttpContext.response - The outgoing HTTP response object.
   * @return {Promise<Object>} A JSON response with a message.
   */
  async index({ request, response, auth }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 50)
    const search = request.input('search')
    const startDate = request.input('startDate')
    const endDate = request.input('endDate')
    const users = await this.getAllUsersUseCase.execute(page, perPage, search, startDate, endDate)

    emitter.emit('activity:audit', {
      eventCategory: 'USERS',
      eventAction: 'READ_USERS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as any)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { page, perPage, search, startDate, endDate },
      result: AuditResult.SUCCESS,
    })

    return response.ok(users)
  }

  /**
   * Retrieves general user statistics.
   *
   * @param {HttpContext} context - The HTTP context object.
   * @return {Promise<void>}
   */
  async stats({ request, response, auth }: HttpContext): Promise<void> {
    const startDate = request.input('startDate')
    const endDate = request.input('endDate')
    const stats = await this.getUserStatsUseCase.execute(startDate, endDate)

    emitter.emit('activity:audit', {
      eventCategory: 'USERS',
      eventAction: 'READ_USERS_STATS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as Admin)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { startDate, endDate },
      result: AuditResult.SUCCESS,
    })

    return response.ok(stats)
  }

  /**
   * Retrieves wallet statistics for a specific user and sends the response.
   *
   * @param {Object} context - The HTTP context object containing request and response details.
   * @param {Object} context.params - The parameters from the HTTP request.
   * @param {Object} context.params.id - The ID of the user whose wallet statistics are to be retrieved.
   * @param {Object} context.response - The HTTP response object used to send the result.
   * @return {Promise<void>} A Promise that resolves when the response is sent.
   */
  async walletStats({ params, response, request, auth }: HttpContext): Promise<void> {
    const stats = await this.getUserWalletStatsUseCase.execute(params.id)

    emitter.emit('activity:audit', {
      eventCategory: 'USERS',
      eventAction: 'READ_USER_WALLET_STATS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as Admin)?.role?.slug ?? null,
      targetType: 'user',
      targetId: params.id,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      result: AuditResult.SUCCESS,
    })

    return response.ok(stats)
  }

  /**
   * Retrieves detailed information for a specific user and sends the response.
   *
   * @param {Object} context - The HTTP context object containing request and response details.
   * @param {Object} context.params - The parameters from the HTTP request.
   * @param {Object} context.params.id - The ID of the user whose details are to be retrieved.
   * @param {Object} context.response - The HTTP response object used to send the result.
   * @return {Promise<void>} A Promise that resolves when the response is sent.
   */
  async show({ params, response, request, auth }: HttpContext): Promise<void> {
    try {
      const user = await this.getAdminUserDetailsUseCase.execute(params.id)

      if (!user) {
        return response.notFound({ message: 'User not found' })
      }

      emitter.emit('activity:audit', {
        eventCategory: 'USERS',
        eventAction: 'VIEW_USER_DETAILS',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as Admin)?.role?.slug ?? null,
        targetType: 'user',
        targetId: params.id,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.SUCCESS,
      })

      return response.ok(user)
    } catch (error) {
      emitter.emit('activity:audit', {
        eventCategory: 'USERS',
        eventAction: 'VIEW_USER_DETAILS',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'user',
        targetId: params.id,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.FAILURE,
        errorMessage: (error as Error)?.message ?? 'User not found',
      })
      return response.notFound({ message: 'User not found' })
    }
  }

  /**
   * Blocks a specific user account and sends a response.
   *
   * @param {Object} context - The HTTP context object containing request and response details.
   * @param {Object} context.params - The parameters from the HTTP request.
   * @param {Object} context.params.id - The ID of the user to be blocked.
   * @param {Object} context.response - The HTTP response object used to send the result.
   * @return {Promise<void>} A Promise that resolves when the response is sent.
   */
  async block({ params, response, request, auth }: HttpContext): Promise<void> {
    try {
      await this.changeUserStateUseCase.execute(params.id, UserStatus.BLOCKED)

      emitter.emit('activity:audit', {
        eventCategory: 'USERS',
        eventAction: 'BLOCK_USER',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'user',
        targetId: params.id,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        newValues: { status: UserStatus.BLOCKED },
        result: AuditResult.SUCCESS,
      })

      return response.ok({ message: 'User blocked successfully' })
    } catch (error) {
      emitter.emit('activity:audit', {
        eventCategory: 'USERS',
        eventAction: 'BLOCK_USER',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as Admin)?.role?.slug ?? null,
        targetType: 'user',
        targetId: params.id,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.FAILURE,
        errorMessage: (error as Error)?.message,
      })
      throw error
    }
  }

  /**
   * Activates a specific user account and sends a response.
   *
   * @param {Object} context - The HTTP context object containing request and response details.
   * @param {Object} context.params - The parameters from the HTTP request.
   * @param {Object} context.params.id - The ID of the user to be activated.
   * @param {Object} context.response - The HTTP response object used to send the result.
   * @return {Promise<void>} A Promise that resolves when the response is sent.
   */
  async activate({ params, response, request, auth }: HttpContext): Promise<void> {
    try {
      await this.changeUserStateUseCase.execute(params.id, UserStatus.ACTIVE)

      emitter.emit('activity:audit', {
        eventCategory: 'USERS',
        eventAction: 'ACTIVATE_USER',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as any)?.role?.slug ?? null,
        targetType: 'user',
        targetId: params.id,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        newValues: { status: UserStatus.ACTIVE },
        result: AuditResult.SUCCESS,
      })

      return response.ok({ message: 'User activated successfully' })
    } catch (error) {
      emitter.emit('activity:audit', {
        eventCategory: 'USERS',
        eventAction: 'ACTIVATE_USER',
        actorId: auth.user?.id ?? null,
        actorType: 'admin',
        actorRole: (auth.user as Admin)?.role?.slug ?? null,
        targetType: 'user',
        targetId: params.id,
        requestId: request.header('x-request-id') ?? null,
        ipAddress: request.ip(),
        userAgent: request.header('user-agent') ?? null,
        result: AuditResult.FAILURE,
        errorMessage: (error as Error)?.message,
      })
      throw error
    }
  }

  /**
   * Handles the search functionality by retrieving a search term from the request,
   * executing a use case to perform the search, and returning the result in the response.
   *
   * @param {Object} context - The HTTP context object containing request and response.
   * @param {Object} context.request - The HTTP request object.
   * @param {Object} context.response - The HTTP response object.
   * @return {Promise<void>} Resolves with no return value, but sends a response with the search results or an error message.
   */
  async search({ request, response, auth }: HttpContext): Promise<void> {
    const search = request.input('q')

    if (!search) {
      return response.badRequest({ message: 'le terme de recherche est requis' })
    }

    const result = await this.searchUserUseCase.execute(search)

    emitter.emit('activity:audit', {
      eventCategory: 'USERS',
      eventAction: 'SEARCH_USERS',
      actorId: auth.user?.id ?? null,
      actorType: 'admin',
      actorRole: (auth.user as Admin)?.role?.slug ?? null,
      requestId: request.header('x-request-id') ?? null,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent') ?? null,
      metadata: { query: search },
      result: AuditResult.SUCCESS,
    })

    return response.ok(result)
  }
}
