import { WalletStatus } from '#features/wallet/domain/enum/wallet_status'

export interface UpdateWalletStatusCommand {
  userId: string
  status: WalletStatus
}
