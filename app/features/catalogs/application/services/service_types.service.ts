import { inject } from '@adonisjs/core'
import {
  ServiceTypeCreateDto,
  ServiceTypeUpdateDto,
} from '#features/catalogs/application/dtos/service_types.dto'
import ServiceTypeRepository, {
  ListServiceTypesParams,
} from '#features/catalogs/domain/interfaces/service_type_repository'
import { Exception } from '@adonisjs/core/exceptions'
import ServiceType from '#features/catalogs/domain/models/service_type'

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
   * Retrieves a service type by its code.
   * If the service type is not found, it throws an exception with a status code of 404.
   * @param code
   * @return {Promise<ServiceType>} A promise that resolves to the service type object if found, or rejects with an error if not found.
   */
  async findByCode(code: string): Promise<ServiceType> {
    const serviceType = await this.repo.findByCode(code)

    if (!serviceType) {
      throw new Exception('Service Type not found', {
        status: 404,
        code: 'E_NOT_FOUND',
      })
    }

    return serviceType
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
