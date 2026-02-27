export interface ProviderItemDto {
  code: string
  name: string
  feeFixed: number
  feePercent: number
  currency?: string
  // Inter-network support: optional destination provider details
  toProviderCode?: string
  toProviderName?: string
  isInterNetwork?: boolean
  // Optional origin provider details (used for page 2 responses)
  fromProviderCode?: string
  fromProviderName?: string
}

export interface PaymentMethodItemDto {
  code: string
  name: string
  providers: ProviderItemDto[]
}

export interface PaymentOptionsByServiceTypeResult {
  serviceType: string
  methods: PaymentMethodItemDto[]
}
