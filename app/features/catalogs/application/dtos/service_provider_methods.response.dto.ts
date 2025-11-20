export interface ServiceProviderMethodResponseDto {
  id: number
  serviceType: { id: number; code: string; label: string }
  paymentMethod: { id: number; code: string; label: string }
  providerFrom: { id: number; code: string; name: string }
  providerTo?: { id: number; code: string; name: string } | null
  feeFixed: number | string
  feePercent: number
  currency: string
  isActive: boolean
  createdAt?: string | Date
  updatedAt?: string | Date
}
