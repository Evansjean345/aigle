export interface AdminUserWalletStatsDto {
  wallet: {
    balance: number
    currency: string
    status: string
    limitPerTransaction: number
    limitDaily: number
    limitMonthly: number
    balanceLimit: number
  }
  activity: {
    todayTxCount: number
    todayVolume: number
    monthVolume: number
    lastTxDate: string | null
    lastTxAmount: number | null
  }
}
