import ServiceType from '#features/catalogs/domain/models/service_type'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import ServiceTypeRepository, {
  ListServiceTypesParams,
} from '#features/catalogs/domain/interfaces/service_type_repository'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Implementation of the ServiceTypeRepository interface, providing methods to interact
 * with the service type data source.
 */
export default class ServiceTypeRepositoryImpl implements ServiceTypeRepository {
  /**
   * Handles the pagination of service type records based on provided parameters.
   *
   * @param {Object} params - The parameters for pagination and filtering.
   * @param {number} [params.page=1] - The current page number to retrieve.
   * @param {number} [params.limit=20] - The number of records to display per page.
   * @param {string} [params.q] - A query string to filter records by matching the 'code' or 'label'.
   * @return {Promise<ModelPaginatorContract<ServiceType>>} A promise that resolves to the paginated result, including metadata and data objects.
   */
  async paginate(params: ListServiceTypesParams): Promise<ModelPaginatorContract<ServiceType>> {
    const { page = 1, limit = 20, q } = params
    const query = ServiceType.query().orderBy('id', 'desc')

    if (q) {
      query.where((builder) => {
        builder.whereILike('code', `%${q}%`).orWhereILike('label', `%${q}%`)
      })
    }

    return query.paginate(Number(page), Number(limit))
  }

  /**
   * Retrieves a record by its ID or throws an error if the record is not found.
   *
   * @param {number} id - The unique identifier of the record to retrieve.
   * @return {Promise<ServiceType>} A promise that resolves to the record if found, or rejects with an error.
   */
  findByIdOrFail(id: number): Promise<ServiceType> {
    return ServiceType.findOrFail(id)
  }

  /**
   * Retrieves a service type record by its code.
   * @param code
   * @return {Promise<ServiceType | null>} A promise that resolves to the service type record if found, or null if not found.
   */
  async findByCode(code: string): Promise<ServiceType> {
    const serviceType = await ServiceType.query().where('code', code).first()

    if (!serviceType) {
      throw new Exception("Ce type de service n'existe pas.", {
        code: 'E_SERVICE_TYPE_NOT_FOUND',
        status: 404,
      })
    }
    return serviceType
  }

  /**
   * Creates a new service type record with the provided data.
   *
   * @param {Object} data - The data for the new service type.
   * @param {string} data.code - The unique code identifying the service type.
   * @param {string} data.label - The label or name of the service type.
   * @param {string|null|undefined} [data.description] - An optional description of the service type.
   * @return {Promise<ServiceType>} A promise that resolves to the created service type record.
   */
  async create(data: {
    code: string
    label: string
    description?: string | null
  }): Promise<ServiceType> {
    return ServiceType.create(data)
  }

  /**
   * Updates an existing record with the provided data based on the given ID.
   *
   * @param {number} id - The ID of the record to update.
   * @param {Partial<{code: string, label: string, description?: string | null}>} data - Partial object containing the properties to update.
   * @return {Promise<ServiceType>} Returns the updated record.
   */
  async update(
    id: number,
    data: Partial<{ code: string; label: string; description?: string | null }>
  ): Promise<ServiceType> {
    const item = await ServiceType.findOrFail(id)
    item.merge(data)
    await item.save()
    return item
  }

  async delete(id: number) {
    const item = await ServiceType.findOrFail(id)
    await item.delete()
  }
}
