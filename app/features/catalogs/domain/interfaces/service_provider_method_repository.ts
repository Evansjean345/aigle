import ServiceProviderMethod from '#features/catalogs/domain/models/service_provider_method'

export interface ListSpmParams {
  page?: number
  limit?: number
  isActive?: boolean
  serviceTypeId?: number
  paymentMethodId?: number
  providerFromId?: number
}

export default abstract class ServiceProviderMethodRepository {
  abstract paginate(params: ListSpmParams): Promise<any>
  abstract findByIdOrFail(id: number): Promise<ServiceProviderMethod>
  abstract findByIdWithRelationsOrFail(id: number): Promise<ServiceProviderMethod>
  abstract create(data: {
    serviceTypeId: number
    paymentMethodId: number
    providerFromId: number
    providerToId?: number | null
    feeFixed?: bigint | number
    feePercent?: number
    currency?: string
    isActive?: boolean
  }): Promise<ServiceProviderMethod>
  abstract update(
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
  abstract delete(id: number): Promise<void>
}
