import ServiceProviderMethod from '#shared/models/service_provider_method'
import {
  ListSpmParams,
  ServiceProviderMethodRepositoryContract,
} from '#shared/interfaces/services_management/index'
import { ModelPaginatorContract } from '@adonisjs/lucid/types/model'

/**
 * A repository class for managing service provider methods. Provides methods to
 * retrieve, create, update, and delete service provider methods as well as handle
 * pagination and load related entities.
 */
export default class ServiceProviderMethodRepository
  implements ServiceProviderMethodRepositoryContract
{
  /**
   * Handles the pagination and retrieval of service provider methods based on the provided parameters.
   *
   * @param {ListSpmParams} params - The parameters for filtering and pagination.
   * @param {number} [params.page=1] - The page number for pagination.
   * @param {number} [params.limit=20] - The number of records per page for pagination.
   * @param {boolean} [params.isActive] - Filter by active status.
   * @param {number} [params.serviceTypeId] - Filter by the ID of the service type.
   * @param {number} [params.paymentMethodId] - Filter by the ID of the payment method.
   * @param {number} [params.providerFromId] - Filter by the ID of the provider from.
   * @return {Promise<Pagination>} Returns a paginated set of service provider methods based on the given parameters.
   */
  async paginate(params: ListSpmParams): Promise<ModelPaginatorContract<ServiceProviderMethod>> {
    const {
      page = 1,
      limit = 20,
      isActive,
      serviceTypeId,
      paymentMethodId,
      providerFromId,
    } = params

    const query = ServiceProviderMethod.query()
      .preload('serviceType')
      .preload('paymentMethod')
      .preload('providerFrom')
      .preload('providerTo')
      .orderBy('id', 'desc')

    if (isActive !== undefined) query.andWhere('is_active', isActive)
    if (serviceTypeId) query.andWhere('service_type_id', Number(serviceTypeId))
    if (paymentMethodId) query.andWhere('payment_method_id', Number(paymentMethodId))
    if (providerFromId) query.andWhere('provider_from_id', Number(providerFromId))

    return query.paginate(Number(page), Number(limit))
  }

  /**
   * Retrieves a record by its unique identifier, or throws an exception if no record is found.
   *
   * @param {number} id - The unique identifier of the record to be retrieved.
   * @return {Promise<ServiceProviderMethod>} A promise that resolves to the record if found, or throws an exception if not found.
   */
  findByIdOrFail(id: number): Promise<ServiceProviderMethod> {
    return ServiceProviderMethod.findOrFail(id)
  }

  /**
   * Finds an entity by its ID and loads related data using predefined relations.
   * Throws an error if the entity is not found.
   *
   * @param {number} id - The ID of the entity to find.
   * @return {Promise<Object>} The entity with its related data loaded.
   */
  async findByIdWithRelationsOrFail(id: number): Promise<ServiceProviderMethod> {
    const item = await ServiceProviderMethod.query()
      .where('id', id)
      .preload('serviceType')
      .preload('paymentMethod')
      .preload('providerFrom')
      .preload('providerTo')
      .first()
    if (!item) throw new Error('E_ROW_NOT_FOUND')
    return item
  }

  /**
   * Creates a new service provider method with the specified details.
   *
   * @param {Object} data The data required to create the service provider method.
   * @param {number} data.serviceTypeId The ID of the service type.
   * @param {number} data.paymentMethodId The ID of the payment method.
   * @param {number} data.providerFromId The ID of the provider initiating the service.
   * @param {number|null} [data.providerToId] The ID of the target provider, if applicable.
   * @param {bigint|number} [data.feeFixed] The fixed fee amount, defaults to 0.
   * @param {number} [data.feePercent] The percentage-based fee, defaults to 0.
   * @param {string} [data.currency] The currency used for fees, defaults to 'XOF'.
   * @param {boolean} [data.isActive] Indicates if the method is active, defaults to true.
   * @return {Promise<Object>} The created service provider method with its relations.
   */
  async create(data: {
    serviceTypeId: number
    paymentMethodId: number
    providerFromId: number
    providerToId?: number | null
    feeFixed?: bigint | number
    feePercent?: number
    currency?: string
    isActive?: boolean
  }): Promise<ServiceProviderMethod> {
    const created = await ServiceProviderMethod.create({
      serviceTypeId: Number(data.serviceTypeId),
      paymentMethodId: Number(data.paymentMethodId),
      providerFromId: Number(data.providerFromId),
      providerToId: data.providerToId !== undefined ? Number(data.providerToId) : null,
      feeFixed: data.feeFixed ?? 0,
      feePercent: data.feePercent ?? 0,
      currency: data.currency ?? 'XOF',
      isActive: data.isActive ?? true,
    })

    return this.findByIdWithRelationsOrFail(created.id)
  }

  /**
   * Updates a service provider method with the provided data.
   *
   * @param {number} id - The unique identifier of the service provider method to update.
   * @param {Object} data - An object containing the properties to update.
   * @param {number} [data.serviceTypeId] - The ID of the service type.
   * @param {number} [data.paymentMethodId] - The ID of the payment method.
   * @param {number} [data.providerFromId] - The ID of the originating provider.
   * @param {number|null} [data.providerToId] - The ID of the destination provider or null.
   * @param {bigint|number} [data.feeFixed] - The fixed fee applied.
   * @param {number} [data.feePercent] - The percentage fee applied.
   * @param {string} [data.currency] - The currency associated with this method.
   * @param {boolean} [data.isActive] - The active status of the method.
   * @return {Promise<Object>} The updated service provider method including its relations.
   */
  async update(
    id: number,
    data: Partial<{
      serviceTypeId: number
      paymentMethodId: number
      providerFromId: number
      providerToId?: number | null
      feeFixed?: bigint | number
      feePercent?: number
      currency?: string
      isActive?: boolean
    }>
  ): Promise<ServiceProviderMethod> {
    const item = await ServiceProviderMethod.findOrFail(id)

    item.merge({
      serviceTypeId: data.serviceTypeId ?? item.serviceTypeId,
      paymentMethodId: data.paymentMethodId ?? item.paymentMethodId,
      providerFromId: data.providerFromId ?? item.providerFromId,
      providerToId: data.providerToId !== undefined ? Number(data.providerToId) : item.providerToId,
      feeFixed: data.feeFixed ?? item.feeFixed,
      feePercent: data.feePercent ?? item.feePercent,
      currency: data.currency ?? item.currency,
      isActive: data.isActive ?? item.isActive,
    })

    await item.save()
    return this.findByIdWithRelationsOrFail(item.id)
  }

  /**
   * Deletes an item with the specified ID.
   *
   * @param {number} id - The unique identifier of the item to be deleted.
   * @return {Promise<void>} A promise that resolves when the item is successfully deleted.
   */
  async delete(id: number): Promise<void> {
    const item = await ServiceProviderMethod.findOrFail(id)
    await item.delete()
  }
}
