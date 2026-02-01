import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import GetAllAppVersionsUseCase from '#features/device/application/use_cases/admin/get_all_app_versions_use_case'
import CreateAppVersionUseCase from '#features/device/application/use_cases/admin/create_app_version_use_case'
import GetAppVersionDetailsUseCase from '#features/device/application/use_cases/admin/get_app_version_details_use_case'
import UpdateAppVersionUseCase from '#features/device/application/use_cases/admin/update_app_version_use_case'
import DeleteAppVersionUseCase from '#features/device/application/use_cases/admin/delete_app_version_use_case'
import {
  createAppVersionValidator,
  updateAppVersionValidator,
} from '#features/device/presentation/admin/validators/app_version_validator'

@inject()
export default class AdminAppVersionController {
  /**
   * Constructs an instance of the class with the specified use cases.
   *
   * @param {GetAllAppVersionsUseCase} getAllAppVersionsUseCase - Use case for retrieving all application versions.
   * @param {CreateAppVersionUseCase} createAppVersionUseCase - Use case for creating a new application version.
   * @param {GetAppVersionDetailsUseCase} getAppVersionDetailsUseCase - Use case for retrieving details of a specific application version.
   * @param {UpdateAppVersionUseCase} updateAppVersionUseCase - Use case for updating an existing application version.
   * @param {DeleteAppVersionUseCase} deleteAppVersionUseCase - Use case for deleting an application version.
   */
  constructor(
    private getAllAppVersionsUseCase: GetAllAppVersionsUseCase,
    private createAppVersionUseCase: CreateAppVersionUseCase,
    private getAppVersionDetailsUseCase: GetAppVersionDetailsUseCase,
    private updateAppVersionUseCase: UpdateAppVersionUseCase,
    private deleteAppVersionUseCase: DeleteAppVersionUseCase
  ) {}

  /**
   * Handles the request to fetch all application versions.
   *
   * @param {object} context - The HTTP context object.
   * @param {object} context.response - The response object used to send the result back to the client.
   * @return {Promise<void>} A Promise resolving to the response containing all application versions.
   */
  async index({ response }: HttpContext): Promise<void> {
    const versions = await this.getAllAppVersionsUseCase.execute()
    return response.ok(versions)
  }

  /**
   * Handles the storage of a new application version.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.request - The HTTP request object containing the data to be validated and stored.
   * @param {Object} context.response - The HTTP response object used to send the created response.
   * @return {Promise<void>} Returns a promise that resolves to the created application version.
   */
  async store({ request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(createAppVersionValidator)
    const version = await this.createAppVersionUseCase.execute(data)
    return response.created(version)
  }

  /**
   * Handles the retrieval and response of application version details.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - The request parameters.
   * @param {Object} context.response - The HTTP response object.
   * @return {Promise<void>} Resolves when the application version details are successfully retrieved and sent in the response.
   */
  async show({ params, response }: HttpContext): Promise<void> {
    const version = await this.getAppVersionDetailsUseCase.execute(params.id)
    return response.ok(version)
  }

  /**
   * Updates the application version based on the provided parameters and request data.
   *
   * @param {Object} context - The HTTP context object.
   * @param {Object} context.params - The route parameters.
   * @param {Object} context.params.id - The identifier of the application version to update.
   * @param {Object} context.request - The HTTP request object containing the validation and input data.
   * @param {Object} context.response - The HTTP response object used to send the results.
   * @return {Promise<Object>} The updated application version.
   */
  async update({ params, request, response }: HttpContext): Promise<void> {
    const data = await request.validateUsing(updateAppVersionValidator)

    console.log('debugging data')
    console.log(data)

    const version = await this.updateAppVersionUseCase.execute(params.id, data)
    return response.ok(version)
  }

  /**
   * Handles the deletion of an application version by its identifier.
   *
   * @param {Object} context The HTTP context object.
   * @param {Object} context.params The parameters from the request, including the application version ID.
   * @param {Object} context.response The response object used to send back an HTTP response.
   * @return {void} Sends a no-content HTTP response upon successful deletion.
   */
  async destroy({ params, response }: HttpContext): Promise<void> {
    await this.deleteAppVersionUseCase.execute(params.id)
    return response.noContent()
  }
}
