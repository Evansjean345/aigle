import type { DateTime } from 'luxon'
import type {
  AdjustmentType,
  AdjustmentReason,
} from '#core/money/wallet/domain/enums/wallet_adjustment'
import type { WalletAdjustmentResult } from '#core/money/wallet/application/dtos/wallet_adjustment.dto'

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

  /**
   * Construit la réponse depuis l'ajustement projeté par le service.
   *
   * @param {WalletAdjustmentResult} adjustment - Ajustement exécuté.
   * @returns {WalletAdjustmentResponseDTO} La réponse destinée au back-office.
   */
  static fromResult(adjustment: WalletAdjustmentResult): WalletAdjustmentResponseDTO {
    const dto = new WalletAdjustmentResponseDTO()
    dto.adjustmentUid = adjustment.adjustmentUid
    dto.walletId = adjustment.walletId
    dto.type = adjustment.type
    dto.reason = adjustment.reason
    dto.amount = adjustment.amount
    dto.balanceBefore = adjustment.balanceBefore
    dto.balanceAfter = adjustment.balanceAfter
    dto.transactionId = adjustment.transactionId
    dto.adminId = adjustment.adminId
    dto.comment = adjustment.comment
    dto.executedAt = adjustment.executedAt
    return dto
  }
}
