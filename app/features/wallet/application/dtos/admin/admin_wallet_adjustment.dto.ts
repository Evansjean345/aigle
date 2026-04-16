import type { DateTime } from 'luxon'
import type WalletAdjustment from '#features/wallet/domain/models/wallet_adjustment'
import type {
  AdjustmentType,
  AdjustmentReason,
} from '#features/wallet/domain/enums/wallet_adjustment'
import type Transaction from '#features/transactions/domain/models/transaction'

// ── RequestDto (input use case) ─────────────────────────────────────

export interface ExecuteWalletAdjustmentRequestDto {
  walletId: number
  type: AdjustmentType
  reason: AdjustmentReason
  amount: number
  comment: string
  adminId: number
  transactionReference?: string
}

// ── Command (input service) ─────────────────────────────────────────

export interface WalletAdjustmentCommand {
  walletId: number
  type: AdjustmentType
  reason: AdjustmentReason
  amount: number
  comment: string
  adminId: number
  transaction?: Transaction | null
}

// ── Result (output service) ─────────────────────────────────────────

export interface WalletAdjustmentResult {
  walletAdjustment: WalletAdjustment
  balanceBefore: number
  balanceAfter: number
}

// ── Response (output HTTP) ──────────────────────────────────────────

export class WalletAdjustmentResponseDTO {
  declare adjustmentUid: string
  declare walletId: number
  declare type: string
  declare reason: string
  declare amount: number
  declare balanceBefore: number
  declare balanceAfter: number
  declare transactionId: number | null
  declare adminId: number
  declare comment: string
  declare executedAt: DateTime

  static fromAdjustment(adjustment: WalletAdjustment): WalletAdjustmentResponseDTO {
    const dto = new WalletAdjustmentResponseDTO()
    dto.adjustmentUid = adjustment.adjustmentUid
    dto.walletId = adjustment.walletId
    dto.type = adjustment.type
    dto.reason = adjustment.reason
    dto.amount = Number(adjustment.amount)
    dto.balanceBefore = Number(adjustment.balanceBefore)
    dto.balanceAfter = Number(adjustment.balanceAfter)
    dto.transactionId = adjustment.transactionId
    dto.adminId = adjustment.adminId
    dto.comment = adjustment.comment
    dto.executedAt = adjustment.executedAt
    return dto
  }
}
