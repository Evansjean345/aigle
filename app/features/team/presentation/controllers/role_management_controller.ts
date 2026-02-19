import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListRolesUseCase from '#features/team/application/use_cases/roles/list_roles_use_case'
import CreateRoleUseCase from '#features/team/application/use_cases/roles/create_role_use_case'
import UpdateRoleUseCase from '#features/team/application/use_cases/roles/update_role_use_case'
import DeleteRoleUseCase from '#features/team/application/use_cases/roles/delete_role_use_case'
import GetRoleUseCase from '#features/team/application/use_cases/roles/get_role_use_case'
import Admin from '#features/team/domain/models/admin'
import {
  createRoleValidator,
  updateRoleValidator,
} from '#features/team/presentation/validators/role_validator'

@inject()
export default class RoleManagementController {
  /**
   * Constructs an instance of the class with the provided use case dependencies.
   *
   * @param {ListRolesUseCase} listRolesUseCase - The use case responsible for listing roles.
   * @param {CreateRoleUseCase} createRoleUseCase - The use case responsible for creating a role.
   * @param {UpdateRoleUseCase} updateRoleUseCase - The use case responsible for updating a role.
   * @param {DeleteRoleUseCase} deleteRoleUseCase - The use case responsible for deleting a role.
   * @param {GetRoleUseCase} getRoleUseCase - The use case responsible for getting a role by ID.
   */
  constructor(
    private listRolesUseCase: ListRolesUseCase,
    private createRoleUseCase: CreateRoleUseCase,
    private updateRoleUseCase: UpdateRoleUseCase,
    private deleteRoleUseCase: DeleteRoleUseCase,
    private getRoleUseCase: GetRoleUseCase
  ) {}

  /**
   * Retrieves a paginated list of roles and sends a successful HTTP response.
   *
   * @param {object} context - The HTTP context for the request.
   * @param {object} context.request - The HTTP request object.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise resolving with no value, or rejecting on error.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 10)
    const roles = await this.listRolesUseCase.execute(page, perPage)
    return response.ok(roles)
  }

  /**
   * Retrieves a single role by its ID.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - URL parameters from the request.
   * @param {Object} context.response - The outgoing HTTP response object.
   * @return {Promise<void>} The response containing the role details.
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const role = await this.getRoleUseCase.execute(params.id)
    return response.ok(role)
  }

  /**
   * Handles the storage of a new role by validating the request data,
   * executing the use case, and returning the created role in the response.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.request - The HTTP request object, containing data for validation.
   * @param {Object} context.response - The HTTP response object, used to return the result.
   * @return {Promise<void>} A promise that resolves when the process is complete and a response is sent.
   */
  async store({ request, response, auth }: HttpContext): Promise<void> {
    const data = await request.validateUsing(createRoleValidator)
    const authUser = auth.user as Admin
    const role = await this.createRoleUseCase.execute(data, authUser)
    return response.created(role)
  }

  /**
   * Updates the details of a role using the provided data.
   *
   * @param {object} context - The HTTP context object.
   * @param {object} context.params - URL parameters from the request.
   * @param {object} context.request - The incoming HTTP request object.
   * @param {object} context.response - The outgoing HTTP response object.
   * @return {Promise<void>} The response containing the updated role details.
   */
  async update({ params, request, response, auth }: HttpContext): Promise<void> {
    const data = await request.validateUsing(updateRoleValidator)
    const authUser = auth.user as Admin
    const role = await this.updateRoleUseCase.execute(params.id, data, authUser)
    return response.ok(role)
  }

  /**
   * Handles the destruction of a role by executing the delete operation and returning a response.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - The route parameters.
   * @param {Object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the operation is completed.
   */
  async destroy({ params, response, auth }: HttpContext): Promise<void> {
    const authUser = auth.user as Admin
    await this.deleteRoleUseCase.execute(params.id, authUser)
    return response.noContent()
  }
}
