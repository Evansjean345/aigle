import { inject } from '@adonisjs/core'
import {
  ServiceTypeCreateDto,
  ServiceTypeUpdateDto,
} from '#admin/services_management/dtos/service_types.dto'
import ServiceTypeRepository, {
  ListServiceTypesParams,
} from '#shared/interfaces/services_management/service_type_repository'
import { Exception } from '@adonisjs/core/exceptions'
import ServiceType from '#shared/models/service_type'

@inject()
export default class ServiceTypesService {
  constructor(private readonly repo: ServiceTypeRepository) {}

  list(params: ListServiceTypesParams) {
    return this.repo.paginate(params)
  }

  /**
   * Retrieves an entity by its identifier.
   *
   * @param {number} id - The unique identifier of the entity to be retrieved.
   * @return {Promise<ServiceType} A promise that resolves to the entity if found, or rejects if not found.
   */
  get(id: number): Promise<ServiceType> {
    return this.repo.findByIdOrFail(id)
  }

  /**
   * Creates a new service type record based on the provided data.
   *
   * @param {ServiceTypeCreateDto} data - The data object containing the details of the service type to be created. The `code` and `label` properties are required.
   * @return {Promise<ServiceType>} A promise that resolves to the created service type object.
   * @throws {Exception} Throws an error if the required `code` or `label` fields are missing in the input data.
   */
  async create(data: ServiceTypeCreateDto): Promise<ServiceType> {
    if (!data.code || !data.label) {
      throw new Exception('code and label are required', {
        status: 400,
        code: 'E_VALIDATION_ERROR',
      })
    }

    return this.repo.create({ code: data.code, label: data.label, description: data.description })
  }

  update(id: number, data: ServiceTypeUpdateDto) {
    return this.repo.update(id, data)
  }

  delete(id: number) {
    return this.repo.delete(id)
  }
}
