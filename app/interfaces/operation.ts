export interface NewOperationType {
  payment_details_first: any
  amount: number
  fees: number
  operation_type: string
  frais: number
  users_id: number
  users_uid: string
  total_amount: number
  transaction_type: string
  transaction_fee: number
  is_fee: number
}

export interface OperationType {
  id: number
  transactions_uid: string
  users_id: number
  users_uid: string
  amount: number
  total_amount: number
  operator: 'orange' | 'mtn' | 'moov'
  transaction_type: 'deposit' | 'withdrawal' | 'transfer'
  type_operation: string
  reference: string
  transaction_fee: number
  balance_before: number | null
  balance_after: number | null
  operator_response: Record<string, unknown>
  transaction_metadata: Record<string, unknown>
  currency_code: string | null
  payment_method: string
  receiver_id: number | null
  date_transaction: Date
  description: string | null
  emetteur_number: string | null
  beneficiaire_number: string | null
  currency: string | null
  status: 'pending' | 'completed' | 'failed'
  createdAt: Date
  updatedAt: Date
}

export interface AirtimeType {
  operator_id: number
  amount: number
  country_code: string
  phone_number: string
  reference: string
}

export interface MobileMoneyCheckoutType {
  operation_type: string
  amount: number
  provider: string
  number: string
  country: string
  currency: string
  reference: string
  notify_success_url: string | undefined
  notify_failure_url: string | undefined
  pincode?: string
  success_url?: string
  error_url?: string
}
