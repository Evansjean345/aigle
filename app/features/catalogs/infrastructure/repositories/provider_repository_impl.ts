import Provider, { ProviderType } from '#features/catalogs/domain/models/provider'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import ProviderRepository, {
  ListProvidersParams,
} from '#features/catalogs/domain/interfaces/provider_repository'
import { Exception } from '@adonisjs/core/exceptions'

/**
 * Repository class for managing providers, implementing the `Provider_repository_impl` interface.
 * Handles operations such as pagination, retrieval, creation, updates, and deletion of providers.
 */
export default class ProviderRepositoryImpl implements ProviderRepository {
  /**
   * Retrieves paginated and filtered results of providers based on specified query parameters.
   *
   * @param {ListProvidersParams} params - Object containing query parameters for pagination and filtering.
   * @param {number} [params.page=1] - The page number to retrieve.
   * @param {number} [params.limit=20] - The number of items per page.
   * @param {string} [params.q] - A search query to filter by `code` or `name`.
   * @param {string} [params.type] - A provider type to further filter the results.
   * @return {Promise<object>} - A promise resolving to the paginated results, including metadata about pagination.
   */
  async paginate(params: ListProvidersParams): Promise<ModelPaginatorContract<Provider>> {
    const { page = 1, limit = 20, q, type } = params
    const query = Provider.query().orderBy('id', 'desc')
    if (q) {
      query.where((builder) => {
        builder.whereILike('code', `%${q}%`).orWhereILike('name', `%${q}%`)
      })
    }
    if (type) {
      query.andWhere('type', String(type))
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
   * @param {Object} data - The data for the provider to be created.
   * @param {string} data.code - The unique code identifying the provider.
   * @param {string} data.name - The name of the provider.
   * @param {ProviderType} data.type - The type of the provider.
   * @return {Promise<Provider>} A promise that resolves to the created provider.
   */
  async create(data: { code: string; name: string; type: ProviderType }): Promise<Provider> {
    return Provider.create(data as any)
  }

  /**
   * Updates an existing provider with the provided data.
   *
   * @param {number} id - The unique identifier of the provider to update.
   * @param {Partial<{ code: string; name: string; type: ProviderType }>} data - The partial data object containing the fields to update.
   * @return {Promise<Provider>} A promise that resolves to the updated provider.
   */
  async update(
    id: number,
    data: Partial<{ code: string; name: string; type: ProviderType }>
  ): Promise<Provider> {
    const item = await Provider.findOrFail(id)
    item.merge(data)
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
