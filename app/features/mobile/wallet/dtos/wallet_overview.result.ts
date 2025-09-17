import { WalletCreatedResult } from '#mobile/wallet/dtos/wallet_created_result'

export interface WalletOverviewResult {
  wallet: WalletCreatedResult
  transactions: Transaction[]
}

interface Transaction {
  id: string
}
