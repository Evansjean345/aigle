import Provider from '#features/catalogs/domain/models/provider'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type ProviderRepository from '#features/catalogs/domain/interfaces/provider_repository'
import { Exception } from '@adonisjs/core/exceptions'
import {
  type ListProvidersRequestDto,
  type CreateProviderCommand,
  type UpdateProviderCommand,
  type ProviderStatus,
} from '#features/catalogs/application/dtos/admin/admin_providers.dto'

/**
 * Repository class for managing providers, implementing the `Provider_repository_impl` interface.
 * Handles operations such as pagination, retrieval, creation, updates, and deletion of providers.
 */
export default class ProviderRepositoryImpl implements ProviderRepository {
  /**
   * Retrieves paginated and filtered results of providers based on specified query parameters.
   *
   * @param {ListProvidersRequestDto} params - Object containing query parameters for pagination and filtering.
   * @param {number} [params.page=1] - The page number to retrieve.
   * @param {number} [params.limit=20] - The number of items per page.
   * @param {string} [params.q] - A search query to filter by `code` or `name`.
   * @param {string} [params.type] - A provider type to further filter the results.
   * @return {Promise<object>} - A promise resolving to the paginated results, including metadata about pagination.
   */
  async paginate(params: ListProvidersRequestDto): Promise<ModelPaginatorContract<Provider>> {
    const { page = 1, limit = 20, q, type, status } = params
    const query = Provider.query().orderBy('id', 'desc')
    if (q) {
      query.where((builder) => {
        builder.whereILike('code', `%${q}%`).orWhereILike('name', `%${q}%`)
      })
    }
    if (type) {
      query.andWhere('type', String(type))
    }
    if (status) {
      query.andWhere('status', String(status))
    }
    return query.paginate(Number(page), Number(limit))
  }

  /**
   * Retrieves a provider by the given identifier or throws an error if not found.
   *
   * @param {number} id - The unique identifier of the provider to retrieve.
   * @return {Promise<Provider>} A promise that resolves to the provider if found, or rejects with an error if not found.
   */
  findByIdOrFail(id: number): Promise<Provider> {
    return Provider.findOrFail(id)
  }

  /**
   * Finds a provider by its unique code.
   *
   * @param {string} code - The unique code of the provider to search for.
   * @return {Promise<Provider>} A promise that resolves to the provider object if found.
   * @throws {Exception} Throws an exception if no provider with the given code is found.
   */
  async findByCode(code: string): Promise<Provider> {
    const provider = await Provider.query().where('code', code).first()

    if (!provider) {
      throw new Exception(`Aucun provider avec le code ${code} trouvé`, {
        status: 404,
        code: 'E_PROVIDER_NOT_FOUND',
      })
    }
    return provider
  }

  /**
   * Creates a new provider with the specified data.
   *
   * @param {CreateProviderCommand} data - The data for the provider to be created.
   * @return {Promise<Provider>} A promise that resolves to the created provider.
   */
  async create(data: CreateProviderCommand): Promise<Provider> {
    return Provider.create(data as any)
  }

  /**
   * Updates an existing provider with the provided data.
   *
   * @param {number} id - The unique identifier of the provider to update.
   * @param {UpdateProviderCommand} data - The data object containing the fields to update.
   * @return {Promise<Provider>} A promise that resolves to the updated provider.
   */
  async update(id: number, data: UpdateProviderCommand): Promise<Provider> {
    const item = await Provider.findOrFail(id)
    item.merge(data)
    await item.save()
    return item
  }

  /**
   * Updates the status of a provider (active/inactive).
   *
   * @param {number} id - The unique identifier of the provider.
   * @param {ProviderStatus} status - The new status to apply.
   * @return {Promise<Provider>} A promise resolving to the updated provider.
   */
  async setStatus(id: number, status: ProviderStatus): Promise<Provider> {
    const item = await Provider.findOrFail(id)
    item.status = status
    await item.save()
    return item
  }

  /**
   * Deletes an item with the specified ID.
   *
   * @param {number} id - The unique identifier of the item to be deleted.
   * @return {Promise<void>} A promise that resolves when the item is successfully deleted.
   */
  async delete(id: number): Promise<void> {
    const item = await Provider.findOrFail(id)
    await item.delete()
  }
}
