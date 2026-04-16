import { type WalletStatus } from '#features/wallet/domain/enums/wallet_status'

// ── Command (input service/use case) ────────────────────────────────

export interface UpdateWalletStatusCommand {
  userId: string
  status: WalletStatus
}
