export interface TransactionInterface {
  id: number
  user_id: number
  amount: number
  currency: string
  type: string
  status: string
  reference: string
  description?: string
  created_at: Date
  updated_at: Date
}

export interface CreateTransactionData {
  user_id: number
  amount: number
  currency: string
  type: string
  description?: string
}

export interface UpdateTransactionData {
  status?: string
  description?: string
}
