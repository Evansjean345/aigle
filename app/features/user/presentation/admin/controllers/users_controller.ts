import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllUsersUseCase from '#features/user/application/use_cases/admin/get_all_users_use_case'

@inject()
export default class UsersController {
  /**
   * Initializes a new instance of the class.
   *
   * @param {GetAllUsersUseCase} getAllUsersUseCase - An instance of GetAllUsersUseCase used to retrieve all users.
   */
  constructor(private readonly getAllUsersUseCase: GetAllUsersUseCase) {}

  /**
   * Handles the index request and responds with a standard message.
   *
   * @param {Object} HttpContext - An object containing the request and response.
   * @param {Object} HttpContext.request - The incoming HTTP request object.
   * @param {Object} HttpContext.response - The outgoing HTTP response object.
   * @return {Promise<Object>} A JSON response with a message.
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 10)
    const users = await this.getAllUsersUseCase.execute(page, perPage)
    return response.ok(users)
  }
}
