import ServiceProviderMethod from '#shared/models/service_provider_method'

export interface ListSpmParams {
  page?: number
  limit?: number
  isActive?: boolean
  serviceTypeId?: number
  paymentMethodId?: number
  providerFromId?: number
}

export interface ServiceProviderMethodRepositoryContract {
  paginate(params: ListSpmParams): Promise<any>
  findByIdOrFail(id: number): Promise<ServiceProviderMethod>
  findByIdWithRelationsOrFail(id: number): Promise<ServiceProviderMethod>
  create(data: {
    serviceTypeId: number
    paymentMethodId: number
    providerFromId: number
    providerToId?: number | null
    feeFixed?: bigint | number
    feePercent?: number
    currency?: string
    isActive?: boolean
  }): Promise<ServiceProviderMethod>
  update(
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
  ): Promise<ServiceProviderMethod>
  delete(id: number): Promise<void>
}
