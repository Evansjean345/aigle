import ServiceProviderMethod from '#shared/models/service_provider_method'

export interface ListSpmParams {
  page?: number
  limit?: number
  isActive?: boolean
  serviceTypeId?: number
  paymentMethodId?: number
  providerFromId?: number
}

export default class ServiceProviderMethodRepository {
  async paginate(params: ListSpmParams) {
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

  findByIdOrFail(id: number) {
    return ServiceProviderMethod.findOrFail(id)
  }

  async findByIdWithRelationsOrFail(id: number) {
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

  async create(data: {
    serviceTypeId: number
    paymentMethodId: number
    providerFromId: number
    providerToId?: number | null
    feeFixed?: bigint | number
    feePercent?: number
    currency?: string
    isActive?: boolean
  }) {
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
  ) {
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

  async delete(id: number) {
    const item = await ServiceProviderMethod.findOrFail(id)
    await item.delete()
  }
}
