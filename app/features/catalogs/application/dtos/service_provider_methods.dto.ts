export interface ServiceProviderMethodCreateDto {
  serviceTypeId: number
  paymentMethodId: number
  providerFromId: number
  providerToId?: number | null
  feeFixed?: bigint | number
  feePercent?: number
  currency?: string
  isActive?: boolean
}

export type ServiceProviderMethodUpdateDto = Partial<ServiceProviderMethodCreateDto>
