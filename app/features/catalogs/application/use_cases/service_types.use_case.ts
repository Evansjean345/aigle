import { inject } from '@adonisjs/core'
import ServiceTypesService from '#features/catalogs/application/services/service_types.service'
import {
  ServiceTypeCreateDto,
  ServiceTypeUpdateDto,
} from '#features/catalogs/application/dtos/service_types.dto'
import { ListServiceTypesParams } from '#features/catalogs/domain/interfaces/service_type_repository'

/**
 * Represents the use case for managing Service Types.
 * This class acts as a mediator between the input (like controllers) and the actual service layer.
 */
@inject()
export default class ServiceTypesUseCase {
  /**
   * Initializes a new instance of the class with the provided service dependency.
   *
   * @param {ServiceTypesService} service - The service instance to be used within the class.
   */
  constructor(private readonly service: ServiceTypesService) {}

  /**
   * Retrieves a list of items based on the provided parameters.
   *
   * @param {ListServiceTypesParams} params - The parameters to query the list of items.
   * @return {any} - The result of the list operation from the service.
   */
  list(params: ListServiceTypesParams): any {
    return this.service.list(params)
  }

  /**
   * Retrieves a resource identified by the provided ID.
   *
   * @param {number} id The unique identifier of the resource to retrieve.
   * @return {*} Returns the resource corresponding to the specified ID.
   */
  get(id: number) {
    return this.service.get(id)
  }

  /**
   * Creates a new service entry using the provided payload.
   *
   * @param {ServiceTypeCreateDto} payload - The data transfer object containing information required to create the service.
   * @return {Promise<any>} A Promise that resolves with the result of the service creation process.
   */
  create(payload: ServiceTypeCreateDto) {
    return this.service.create(payload)
  }

  update(id: number, payload: ServiceTypeUpdateDto) {
    return this.service.update(id, payload)
  }

  delete(id: number) {
    return this.service.delete(id)
  }
}
