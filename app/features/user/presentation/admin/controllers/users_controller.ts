import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllUsersUseCase from '#features/user/application/use_cases/admin/get_all_users_use_case'
import GetUserWalletStatsUseCase from '#features/user/application/use_cases/admin/get_user_wallet_stats_use_case'

@inject()
export default class UsersController {
  /**
   * Initializes a new instance of the class.
   *
   * @param {GetAllUsersUseCase} getAllUsersUseCase - An instance of GetAllUsersUseCase used to retrieve all users.
   * @param {GetUserWalletStatsUseCase} getUserWalletStatsUseCase
   */
  constructor(
    private readonly getAllUsersUseCase: GetAllUsersUseCase,
    private readonly getUserWalletStatsUseCase: GetUserWalletStatsUseCase
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
    const perPage = request.input('perPage', 10)
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
}
