import { WalletCreatedResult } from '#mobile/wallet/dtos/wallet_created_result'
import { TransactionResponseDTO } from '#mobile/transactions/dto/transaction.dto'

export interface WalletOverviewResult {
  wallet: WalletCreatedResult
  transactions: TransactionResponseDTO[]
}
