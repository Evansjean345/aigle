import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import {
  ServiceTypeCreateDto,
  ServiceTypeUpdateDto,
} from '#core/catalogs/application/dtos/service_types.dto'
import ServiceTypeRepository, {
  ListServiceTypesParams,
} from '#core/catalogs/domain/interfaces/service_type_repository'

/**
 * Represents the use case for managing Service Types.
 * This class acts as a mediator between the input (like controllers) and the actual repository layer.
 */
@inject()
export default class ServiceTypesUseCase {
  /**
   * Initializes a new instance of the class with the provided repository dependency.
   *
   * @param {ServiceTypeRepository} repository - The repository instance to be used within the class.
   */
  constructor(private readonly repository: ServiceTypeRepository) {}

  /**
   * Retrieves a list of items based on the provided parameters.
   *
   * @param {ListServiceTypesParams} params - The parameters to query the list of items.
   * @return {any} - The result of the list operation from the repository.
   */
  list(params: ListServiceTypesParams): any {
    return this.repository.paginate(params)
  }

  /**
   * Retrieves a resource identified by the provided ID.
   *
   * @param {number} id The unique identifier of the resource to retrieve.
   * @return {*} Returns the resource corresponding to the specified ID.
   */
  get(id: number) {
    return this.repository.findByIdOrFail(id)
  }

  /**
   * Creates a new service entry using the provided payload.
   *
   * @param {ServiceTypeCreateDto} payload - The data transfer object containing information required to create the service.
   * @return {Promise<any>} A Promise that resolves with the result of the service creation process.
   */
  async create(payload: ServiceTypeCreateDto) {
    if (!payload.code || !payload.label) {
      throw new Exception('code and label are required', {
        status: 400,
        code: 'E_VALIDATION_ERROR',
      })
    }

    return this.repository.create({
      code: payload.code,
      label: payload.label,
      description: payload.description,
    })
  }

  update(id: number, payload: ServiceTypeUpdateDto) {
    return this.repository.update(id, payload)
  }

  delete(id: number) {
    return this.repository.delete(id)
  }
}
