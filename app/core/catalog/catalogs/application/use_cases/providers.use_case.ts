import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import ProviderRepository from '#core/catalog/catalogs/domain/interfaces/provider_repository'
import {
  type CreateProviderRequestDto,
  type UpdateProviderRequestDto,
  type ListProvidersQuery,
  type ProviderStatus,
  type ProviderType,
  ProviderResponseDTO,
  ProviderListResponseDTO,
} from '#core/catalog/catalogs/application/dtos/admin/admin_providers.dto'

export const allowedProviderType: ProviderType[] = ['mobile-money', 'bank', 'wallet']
export const allowedProviderStatus: ProviderStatus[] = ['active', 'inactive']

@inject()
export default class ProvidersUseCase {
  /**
   * Initializes a new instance of the class.
   *
   * @param {ProviderRepository} repository - The provider repository.
   * @return The new class instance.
   */
  constructor(private readonly repository: ProviderRepository) {}

  /**
   * Retrieves a paginated list of providers.
   *
   * @param {ListProvidersQuery} params - The parameters used for filtering and paginating the providers.
   * @return The paginated result containing the list of providers.
   */
  async list(params: ListProvidersQuery) {
    const paginator = await this.repository.paginate(params)
    return ProviderListResponseDTO.fromPaginator(paginator)
  }

  /**
   * Retrieves an entity by its unique identifier.
   *
   * @param {number} id The unique identifier of the entity to retrieve.
   * @return The entity matching the given identifier.
   */
  async get(id: number) {
    const provider = await this.repository.findByIdOrFail(id)
    return ProviderResponseDTO.fromProvider(provider)
  }

  /**
   * Creates a new provider after validating required fields and provider type.
   *
   * @param {CreateProviderRequestDto} data - The provider data transfer object.
   * @return {Promise<ProviderResponseDTO>} The created provider entity.
   */
  async create(data: CreateProviderRequestDto): Promise<ProviderResponseDTO> {
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

    const provider = await this.repository.create({
      code: data.code,
      name: data.name,
      type: data.type,
      logo: data.logo,
    })

    return ProviderResponseDTO.fromProvider(provider)
  }

  /**
   * Updates an existing provider.
   *
   * @param {number} id - The unique identifier of the provider.
   * @param {UpdateProviderRequestDto} data - The provider data transfer object.
   * @return {Promise<ProviderResponseDTO>} The updated provider entity.
   */
  async update(id: number, data: UpdateProviderRequestDto): Promise<ProviderResponseDTO> {
    if (data.type && !allowedProviderType.includes(data.type)) {
      throw new Exception(`type must be one of: ${allowedProviderType.join(', ')}`, {
        status: 400,
        code: 'E_VALIDATION_ERROR',
      })
    }
    const provider = await this.repository.update(id, data)
    return ProviderResponseDTO.fromProvider(provider)
  }

  /**
   * Sets the status of a provider.
   * @param {number} id - The unique identifier of the provider.
   * @param {ProviderStatus} status - The new status to set for the provider. Must be one of the allowed provider statuses.
   * @return {Promise<ProviderResponseDTO>} The result of the repository status update operation.
   * @throws {Exception} If the provided status is not an allowed provider status.
   */
  async setStatus(id: number, status: ProviderStatus): Promise<ProviderResponseDTO> {
    if (!allowedProviderStatus.includes(status)) {
      throw new Exception(`status must be one of: ${allowedProviderStatus.join(', ')}`, {
        status: 400,
        code: 'E_VALIDATION_ERROR',
      })
    }
    const provider = await this.repository.setStatus(id, status)
    return ProviderResponseDTO.fromProvider(provider)
  }

  /**
   * Deletes a provider.
   *
   * @param {number} id - The unique identifier of the provider.
   * @return {Promise<void>}
   */
  delete(id: number): Promise<void> {
    return this.repository.delete(id)
  }
}
