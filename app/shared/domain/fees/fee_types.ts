export type FeeOperation = 'add' | 'subtract'

export interface FeeRule {
  feeFixed: number
  feePercent: number
  currency?: string
}

export interface FeeContext {
  amount: number
  operation: FeeOperation
}
