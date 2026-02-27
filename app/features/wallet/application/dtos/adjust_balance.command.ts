// Input for adjusting wallet balance (positive or negative delta)
export interface AdjustBalanceCommand {
  walletId: number
  delta: number
}
