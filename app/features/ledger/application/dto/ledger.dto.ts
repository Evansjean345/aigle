export interface LedgerTransactionDto {
  id: number
  reference: string
  operationType: string
  status: string
  description: string | null
}

export interface LedgerUserDto {
  firstname: string
  lastname: string
  pictureUrl: string | null
  userUid: string
}

export interface LedgerWalletDto {
  id: number
  user: LedgerUserDto
}

export interface LedgerDto {
  id: number
  direction: string
  operationType: string
  description: string | null
  amountBrut: string
  fees: string
  totalAmount: string
  balanceBefore: string
  balanceAfter: string
  createdAt: string
  transaction: LedgerTransactionDto
  wallet: LedgerWalletDto
}
