export type WebhookType = 'checkout_failed' | 'checkout_succeeded' | string
export type WebhookStatus = 'failed' | 'succeeded' | 'pending' | string
export type OperationType = 'mobile_money' | string
export type ActionType = 'withdrawal' | 'deposit' | string
export type CurrencyCode = 'XOF' | string

export interface WebhookData {
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
  amount: number
  currency: CurrencyCode
  status: WebhookStatus
  transactionId: string
  operationType: OperationType
  actionType: ActionType
  paymentDetails: Record<string, any>
  successUrl?: string
  failureUrl?: string
  reference: string
  error?: unknown | null
  fees?: number | null
}

export interface WebhookRequestDto {
  type: WebhookType
  data: WebhookData
  error?: unknown | null
}
