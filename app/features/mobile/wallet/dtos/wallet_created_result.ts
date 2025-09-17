// Stable view of a Wallet exposed to upper layers
export interface WalletCreatedResult {
  id: string
  usersId: string
  currencySymbol?: string
  balance: number
}
