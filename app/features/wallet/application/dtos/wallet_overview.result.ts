import { WalletCreatedResult } from '#features/wallet/application/dtos/wallet_created_result'
import { TransactionResponseDTO } from '#features/transactions/application/dto/transaction.dto'

export interface WalletOverviewResult {
  wallet: WalletCreatedResult
  transactions: TransactionResponseDTO[]
}
