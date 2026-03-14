import type { WalletCreatedResult } from '#features/wallet/application/dtos/wallet_created_result'
import type { MobileTransactionResponseDTO } from '#features/transactions/application/dto/mobile_transaction.dto'

export interface WalletOverviewResult {
  wallet: WalletCreatedResult
  transactions: MobileTransactionResponseDTO[]
}
