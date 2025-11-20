import { inject } from '@adonisjs/core'
import Provider, { ProviderType } from '#features/catalogs/domain/models/provider'
import { Exception } from '@adonisjs/core/exceptions'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import {
  ProviderCreateDto,
  ProviderUpdateDto,
} from '#features/catalogs/application/dtos/providers.dto'
import ProviderRepository, {
  ListProvidersParams,
} from '#features/catalogs/domain/interfaces/provider_repository'

export const allowedProviderType: ProviderType[] = ['mobile_money', 'bank', 'credit-card']

@inject()
export default class ProvidersService {
  /**
   * Constructs an instance of the class with the provided repository implementation.
   *
   * @param {ProviderRepository} repo - The repository implementation to be used in the class.
   */
  constructor(private readonly repo: ProviderRepository) {}

  /**
   * Retrieves a paginated list of providers based on the given parameters.
   *
   * @param {ListProvidersParams} params - Parameters to filter and paginate the list of providers.
   * @return {Promise} A promise that resolves to the paginated list of providers.
   */
  list(params: ListProvidersParams): Promise<ModelPaginatorContract<Provider>> {
    return this.repo.paginate(params)
  }

  /**
   * Retrieves an entity by its unique identifier.
   *
   * @param {number} id - The unique identifier of the entity to retrieve.
   * @return {Promise<any>} A promise that resolves to the entity if found or rejects if not found.
   */
  get(id: number) {
    return this.repo.findByIdOrFail(id)
  }

  /**
   * Creates a new provider entry in the repository with the given data.
   * Validates the input to ensure all required fields are present and that the type is allowed.
   *
   * @param {Object} data - The data to create the provider entry.
   * @param {string} [data.code] - The unique code of the provider.
   * @param {string} [data.name] - The name of the provider.
   * @param {ProviderType} [data.type] - The type of the provider.
   *
   * @throws {Exception} If any required field (code, name, or type) is missing.
   * @throws {Exception} If the provided type is not within the allowed types.
   *
   * @return {Promise<Provider>} A promise that resolves with the created provider entry.
   */
  async create(data: ProviderCreateDto): Promise<Provider> {
    if (!data.code || !data.name || !data.type) {
      throw new Exception('code, name and type are required', {
        status: 400,
        code: 'E_VALIDATION_ERROR',
      })
    }

    if (!allowedProviderType.includes(data.type)) {
      throw new Exception(`type must be one of: ${allowedProviderType.join(', ')}`, {
        status: 400,
        code: 'E_VALIDATION_ERROR',
      })
    }

    return this.repo.create({ code: data.code, name: data.name, type: data.type })
  }

  /**
   * Updates an existing record with the given data.
   *
   * @param {number} id - The unique identifier of the record to update.
   * @param {Partial<{ code: string; name: string; type: ProviderType }>} data - A partial object containing the fields to update.
   * @throws {Error} If the provided type in the data is not included in the allowed types.
   * @return {Promise<Provider>} A promise that resolves when the update is complete.
   */
  async update(id: number, data: ProviderUpdateDto): Promise<Provider> {
    if (data.type && !allowedProviderType.includes(data.type)) {
      throw new Error(`type must be one of: ${allowedProviderType.join(', ')}`)
    }
    return this.repo.update(id, data)
  }

  /**
   * Deletes an entity with the specified ID from the repository.
   *
   * @param {number} id - The unique identifier of the entity to be deleted.
   * @return {Promise<any>} A promise that resolves with the result of the delete operation.
   */
  delete(id: number): Promise<void> {
    return this.repo.delete(id)
  }
}
