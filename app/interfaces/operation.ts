export interface NewOperationType {
  amount: number
  frais: number
  users_id: number
  users_uid: string
  total_amount: number
  transaction_type: string
  transaction_fee: number
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
