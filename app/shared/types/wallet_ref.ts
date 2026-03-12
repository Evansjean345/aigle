export interface WalletRef {
  id: number
  walletsUid: string
  userId: string
  balance: number
  currencySymbol: string | undefined
  status: string
}
