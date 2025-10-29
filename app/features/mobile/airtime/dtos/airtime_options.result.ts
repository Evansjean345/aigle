export interface AirtimeOptionsResult {
  serviceType: string
  methods: {
    id: number
    code: string
    name: string
    order?: number
    providers: {
      id: number
      code: string
      name: string
      logo?: string
      feeFixed: number
      feePercent: number
      currency?: string
      minAmount?: number
      maxAmount?: number
      applyFees?: boolean
    }[]
  }[]
}
