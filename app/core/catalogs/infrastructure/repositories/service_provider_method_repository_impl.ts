import ServiceProviderMethod from '#core/catalogs/domain/models/service_provider_method'
import { type ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type ServiceProviderMethodRepository from '#core/catalogs/domain/interfaces/service_provider_method_repository'
import {
  type ListServiceProviderMethodsRequestDto,
  type CreateServiceProviderMethodCommand,
  type UpdateServiceProviderMethodCommand,
} from '#core/catalogs/application/dtos/admin/admin_service_provider_methods.dto'

/**
 * A repository class for managing service provider methods. Provides methods to
 * retrieve, create, update, and delete service provider methods as well as handle
 * pagination and load related entities.
 */
export default class ServiceProviderMethodRepositoryImpl implements ServiceProviderMethodRepository {
  /**
   * Handles the pagination and retrieval of service provider methods based on the provided parameters.
   *
   * @param {ListServiceProviderMethodsRequestDto} params - The parameters for filtering and pagination.
   * @return {Promise<ModelPaginatorContract<ServiceProviderMethod>>} Returns a paginated set of service provider methods based on the given parameters.
   */
  async paginate(
    params: ListServiceProviderMethodsRequestDto
  ): Promise<ModelPaginatorContract<ServiceProviderMethod>> {
    const {
      page = 1,
      limit = 20,
      isActive,
      serviceTypeId,
      paymentMethodId,
      providerFromId,
      providerToId,
      networkType,
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
    if (providerToId !== undefined) query.andWhere('provider_to_id', Number(providerToId))

    // Filtre par type de réseau (inter/intra)
    if (networkType === 'inter') {
      // Inter-réseaux: providerTo existe ET différent de providerFrom
      query
        .whereNotNull('provider_to_id')
        .whereRaw('CAST(provider_to_id AS UNSIGNED) != CAST(provider_from_id AS UNSIGNED)')
    } else if (networkType === 'intra') {
      // Intra-réseaux: providerTo est null OU égale à providerFrom
      query.where((builder) => {
        builder
          .whereNull('provider_to_id')
          .orWhereRaw('CAST(provider_to_id AS UNSIGNED) = CAST(provider_from_id AS UNSIGNED)')
      })
    }

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
   * @param {CreateServiceProviderMethodCommand} data The data required to create the service provider method.
   * @return {Promise<Object>} The created service provider method with its relations.
   */
  async create(data: CreateServiceProviderMethodCommand): Promise<ServiceProviderMethod> {
    const created = await ServiceProviderMethod.create({
      serviceTypeId: Number(data.serviceTypeId),
      paymentMethodId: Number(data.paymentMethodId),
      providerFromId: Number(data.providerFromId),
      providerToId: data.providerToId !== undefined ? Number(data.providerToId) : null,
      feeFixed: data.feeFixed ?? 0,
      feePercent: data.feePercent ?? 0,
      minAmount: data.minAmount ?? 0,
      currency: data.currency ?? 'XOF',
      isActive: data.isActive ?? true,
    })

    return this.findByIdWithRelationsOrFail(created.id)
  }

  /**
   * Updates a service provider method with the provided data.
   *
   * @param {number} id - The unique identifier of the service provider method to update.
   * @param {UpdateServiceProviderMethodCommand} data - An object containing the properties to update.
   * @return {Promise<Object>} The updated service provider method including its relations.
   */
  async update(
    id: number,
    data: UpdateServiceProviderMethodCommand
  ): Promise<ServiceProviderMethod> {
    const item = await ServiceProviderMethod.findOrFail(id)

    item.merge({
      serviceTypeId: data.serviceTypeId ?? item.serviceTypeId,
      paymentMethodId: data.paymentMethodId ?? item.paymentMethodId,
      providerFromId: data.providerFromId ?? item.providerFromId,
      providerToId:
        data.providerToId !== undefined
          ? data.providerToId === 0 || data.providerToId === null
            ? null
            : Number(data.providerToId)
          : item.providerToId,
      //providerToId: data.providerToId !== undefined ? Number(data.providerToId) : item.providerToId,
      feeFixed: data.feeFixed ?? item.feeFixed,
      feePercent: data.feePercent ?? item.feePercent,
      currency: data.currency ?? item.currency,
      minAmount: data.minAmount ?? item.minAmount,
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
