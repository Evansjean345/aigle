import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListTeamMembersUseCase from '#features/team/application/use_cases/members/list_team_members_use_case'
import CreateAdminUseCase from '#features/team/application/use_cases/members/create_admin_use_case'
import UpdateAdminUseCase from '#features/team/application/use_cases/members/update_admin_use_case'
import DeleteAdminUseCase from '#features/team/application/use_cases/members/delete_admin_use_case'
import {
  createAdminValidator,
  updateAdminValidator,
} from '#features/team/presentation/validators/team_validator'

@inject()
export default class TeamManagementController {
  /**
   * Constructs an instance of the class with the provided use case dependencies.
   *
   * @param {ListTeamMembersUseCase} listTeamMembersUseCase - The use case responsible for listing team members.
   * @param {CreateAdminUseCase} createAdminUseCase - The use case responsible for creating an admin.
   * @param {UpdateAdminUseCase} updateAdminUseCase - The use case responsible for updating an admin.
   * @param {DeleteAdminUseCase} deleteAdminUseCase - The use case responsible for deleting an admin.
   */
  constructor(
    private listTeamMembersUseCase: ListTeamMembersUseCase,
    private createAdminUseCase: CreateAdminUseCase,
    private updateAdminUseCase: UpdateAdminUseCase,
    private deleteAdminUseCase: DeleteAdminUseCase
  ) {}

  /**
   * Retrieves a paginated list of team members and sends a successful HTTP response.
   *
   * @param {object} context - The HTTP context for the request.
   * @param {object} context.request - The HTTP request object.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise resolving with no value, or rejecting on error.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 10)
    const members = await this.listTeamMembersUseCase.execute(page, perPage)
    return response.ok(members)
  }

  /**
   * Handles the storage of a new admin member by validating the request data,
   * executing the use case, and returning the created member in the response.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.request - The HTTP request object, containing data for validation.
   * @param {Object} context.response - The HTTP response object, used to return the result.
   * @return {Promise<void>} A promise that resolves when the process is complete and a response is sent.
   */
  async store({ request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(createAdminValidator)
    const member = await this.createAdminUseCase.execute(data)
    return response.created(member)
  }

  /**
   * Updates the details of an admin using the provided data.
   *
   * @param {object} context - The HTTP context object.
   * @param {object} context.params - URL parameters from the request.
   * @param {object} context.request - The incoming HTTP request object.
   * @param {object} context.response - The outgoing HTTP response object.
   * @return {Promise<void>} The response containing the updated admin details.
   */
  async update({ params, request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(updateAdminValidator)
    const member = await this.updateAdminUseCase.execute(params.id, data)
    return response.ok(member)
  }

  /**
   * Handles the destruction of a resource by executing the delete operation and returning a response.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - The route parameters.
   * @param {Object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the operation is completed.
   */
  async destroy({ params, response }: HttpContext): Promise<void> {
    await this.deleteAdminUseCase.execute(params.id)
    return response.noContent()
  }
}
