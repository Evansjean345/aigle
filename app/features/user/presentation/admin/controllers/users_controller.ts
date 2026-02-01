import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllUsersUseCase from '#features/user/application/use_cases/admin/get_all_users_use_case'
import GetUserWalletStatsUseCase from '#features/user/application/use_cases/admin/get_user_wallet_stats_use_case'
import GetAdminUserDetailsUseCase from '#features/user/application/use_cases/admin/get_admin_user_details_use_case'
import ChangeUserStateUseCase from '#features/user/application/use_cases/admin/change_user_state_use_case'

import { UserStatus } from '#features/user/domain/enum'

@inject()
export default class UsersController {
  /**
   * Initializes a new instance of the class.
   *
   * @param {GetAllUsersUseCase} getAllUsersUseCase - An instance of GetAllUsersUseCase used to retrieve all users.
   * @param {GetUserWalletStatsUseCase} getUserWalletStatsUseCase
   * @param {GetAdminUserDetailsUseCase} getAdminUserDetailsUseCase
   * @param {ChangeUserStateUseCase} changeUserStateUseCase
   */
  constructor(
    private readonly getAllUsersUseCase: GetAllUsersUseCase,
    private readonly getUserWalletStatsUseCase: GetUserWalletStatsUseCase,
    private readonly getAdminUserDetailsUseCase: GetAdminUserDetailsUseCase,
    private readonly changeUserStateUseCase: ChangeUserStateUseCase
  ) {}

  /**
   * Handles the index request and responds with a standard message.
   *
   * @param {Object} HttpContext - An object containing the request and response.
   * @param {Object} HttpContext.request - The incoming HTTP request object.
   * @param {Object} HttpContext.response - The outgoing HTTP response object.
   * @return {Promise<Object>} A JSON response with a message.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 50)
    const users = await this.getAllUsersUseCase.execute(page, perPage)
    return response.ok(users)
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
  async walletStats({ params, response }: HttpContext): Promise<void> {
    const stats = await this.getUserWalletStatsUseCase.execute(params.id)
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
  async show({ params, response }: HttpContext): Promise<void> {
    const user = await this.getAdminUserDetailsUseCase.execute(params.id)

    if (!user) {
      return response.notFound({ message: 'User not found' })
    }

    return response.ok(user)
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
  async block({ params, response }: HttpContext): Promise<void> {
    await this.changeUserStateUseCase.execute(params.id, UserStatus.BLOCKED)
    return response.ok({ message: 'User blocked successfully' })
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
  async activate({ params, response }: HttpContext): Promise<void> {
    await this.changeUserStateUseCase.execute(params.id, UserStatus.ACTIVE)
    return response.ok({ message: 'User activated successfully' })
  }
}
