// Stable view of a Wallet exposed to upper layers
import { WalletStatus } from '#features/wallet/domain/enum/wallet_status'

export interface WalletCreatedResult {
  id: string
  usersId: string
  currencySymbol?: string
  balance: number
  qrcode: string
  status: WalletStatus
}
