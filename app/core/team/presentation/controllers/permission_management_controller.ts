import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import ListPermissionsUseCase from '#core/team/application/use_cases/permissions/list_permissions_use_case'
import ListAllPermissionsUseCase from '#core/team/application/use_cases/permissions/list_all_permissions_use_case'
import CreatePermissionUseCase from '#core/team/application/use_cases/permissions/create_permission_use_case'
import UpdatePermissionUseCase from '#core/team/application/use_cases/permissions/update_permission_use_case'
import DeletePermissionUseCase from '#core/team/application/use_cases/permissions/delete_permission_use_case'
import GetPermissionUseCase from '#core/team/application/use_cases/permissions/get_permission_use_case'
import {
  createPermissionValidator,
  permissionValidatorErrorMessages,
  updatePermissionValidator,
} from '#core/team/presentation/validators/permission_validator'
import { SimpleMessagesProvider } from '@vinejs/vine'
import Admin from '#core/team/domain/models/admin'

@inject()
export default class PermissionManagementController {
  /**
   * Constructs an instance of the class with the provided use case dependencies.
   *
   * @param {ListPermissionsUseCase} listPermissionsUseCase - The use case responsible for listing permissions.
   * @param {ListAllPermissionsUseCase} listAllPermissionsUseCase - The use case responsible for listing all permissions.
   * @param {CreatePermissionUseCase} createPermissionUseCase - The use case responsible for creating a permission.
   * @param {UpdatePermissionUseCase} updatePermissionUseCase - The use case responsible for updating a permission.
   * @param {DeletePermissionUseCase} deletePermissionUseCase - The use case responsible for deleting a permission.
   * @param {GetPermissionUseCase} getPermissionUseCase - The use case responsible for getting a permission by ID.
   */
  constructor(
    private listPermissionsUseCase: ListPermissionsUseCase,
    private listAllPermissionsUseCase: ListAllPermissionsUseCase,
    private createPermissionUseCase: CreatePermissionUseCase,
    private updatePermissionUseCase: UpdatePermissionUseCase,
    private deletePermissionUseCase: DeletePermissionUseCase,
    private getPermissionUseCase: GetPermissionUseCase
  ) {}

  /**
   * Retrieves a paginated list of permissions and sends a successful HTTP response.
   *
   * @param {object} context - The HTTP context for the request.
   * @param {object} context.request - The HTTP request object.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise resolving with no value, or rejecting on error.
   */
  async index({ request, response }: HttpContext): Promise<void> {
    const page = request.input('page', 1)
    const perPage = request.input('perPage', 16)
    const permissions = await this.listPermissionsUseCase.execute(page, perPage)
    return response.ok(permissions)
  }

  /**
   * Retrieves all permissions without pagination.
   *
   * @param {object} context - The HTTP context for the request.
   * @param {object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise resolving with no value.
   */
  async all({ response }: HttpContext): Promise<void> {
    const permissions = await this.listAllPermissionsUseCase.execute()
    return response.ok(permissions)
  }

  /**
   * Retrieves a single permission by its ID.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - URL parameters from the request.
   * @param {Object} context.response - The outgoing HTTP response object.
   * @return {Promise<void>} The response containing the permission details.
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const permission = await this.getPermissionUseCase.execute(params.id)
    return response.ok(permission)
  }

  /**
   * Handles the storage of a new permission by validating the request data,
   * executing the use case, and returning the created permission in the response.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.request - The HTTP request object, containing data for validation.
   * @param {Object} context.response - The HTTP response object, used to return the result.
   * @return {Promise<void>} A promise that resolves when the process is complete and a response is sent.
   */
  async store({ request, response, auth }: HttpContext): Promise<void> {
    const data = await request.validateUsing(createPermissionValidator, {
      messagesProvider: new SimpleMessagesProvider(permissionValidatorErrorMessages),
    })
    const authUser = auth.user as Admin
    const permission = await this.createPermissionUseCase.execute(data, authUser)
    return response.created(permission)
  }

  /**
   * Updates the details of a permission using the provided data.
   *
   * @param {object} context - The HTTP context object.
   * @param {object} context.params - URL parameters from the request.
   * @param {object} context.request - The incoming HTTP request object.
   * @param {object} context.response - The outgoing HTTP response object.
   * @return {Promise<void>} The response containing the updated permission details.
   */
  async update({ params, request, response, auth }: HttpContext): Promise<void> {
    const data = await request.validateUsing(updatePermissionValidator)
    const authUser = auth.user as Admin
    const permission = await this.updatePermissionUseCase.execute(params.id, data, authUser)
    return response.ok(permission)
  }

  /**
   * Handles the destruction of a permission by executing the delete operation and returning a response.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - The route parameters.
   * @param {Object} context.response - The HTTP response object.
   * @return {Promise<void>} A promise that resolves when the operation is completed.
   */
  async destroy({ params, response, auth }: HttpContext): Promise<void> {
    const authUser = auth.user as Admin
    await this.deletePermissionUseCase.execute(params.id, authUser)
    return response.noContent()
  }
}
