export interface TransactionRef {
  id: number
  transactionsUid: string
  usersId: number
  usersUid: string
  amount: number
  totalAmount: number
  fees: number
  operationType: string
  direction: string
  reference: string
  status: string
  receiverId: number | null
  description: string | null
  walletId?: number
}
