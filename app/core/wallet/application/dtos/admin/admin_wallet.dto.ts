import { type WalletStatus } from '#core/wallet/domain/enums/wallet_status'

// ── Command (input service/use case) ────────────────────────────────

export interface UpdateWalletStatusCommand {
  userId: string
  status: WalletStatus
}
