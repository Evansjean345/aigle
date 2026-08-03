import type { DateTime } from 'luxon'
import type {
  AdjustmentType,
  AdjustmentReason,
} from '#core/money/wallet/domain/enums/wallet_adjustment'
import type {
  WalletAdjustmentListItemResult,
  WalletAdjustmentsPaginationMeta,
  PaginatedWalletAdjustmentsResult,
} from '#core/money/wallet/application/dtos/wallet_adjustment.dto'

// ── RequestDto (input use case) ─────────────────────────────────────

export interface ListWalletAdjustmentsRequestDto {
  page?: number
  perPage?: number
  walletId?: number
  userId?: string
  adminId?: number
  type?: AdjustmentType
  reason?: AdjustmentReason
  search?: string
  minAmount?: number
  maxAmount?: number
  startDate?: string
  endDate?: string
}

// ── Response (output HTTP) ──────────────────────────────────────────

export class WalletAdjustmentListItemResponseDTO {
  declare id: number
  declare adjustmentUid: string
  declare walletId: number
  declare type: string
  declare reason: string
  declare status: string
  declare amount: number
  declare balanceBefore: number
  declare balanceAfter: number
  declare comment: string
  declare executedAt: DateTime
  declare createdAt: DateTime
  declare transaction: {
    id: number
    reference: string
  } | null
  declare wallet: {
    id: number
    walletsUid: string
    currencySymbol?: string
    user: {
      usersUid: string
      firstname: string
      lastname: string
    } | null
  } | null
  declare admin: {
    id: number
    firstname: string
    lastname: string
    email: string
  } | null

  /**
   * Construit une ligne depuis l'ajustement projeté par le service.
   *
   * @param {WalletAdjustmentListItemResult} adjustment - Ajustement projeté.
   * @returns {WalletAdjustmentListItemResponseDTO} La ligne destinée au back-office.
   */
  static fromResult(
    adjustment: WalletAdjustmentListItemResult
  ): WalletAdjustmentListItemResponseDTO {
    const dto = new WalletAdjustmentListItemResponseDTO()
    dto.id = adjustment.id
    dto.adjustmentUid = adjustment.adjustmentUid
    dto.walletId = adjustment.walletId
    dto.type = adjustment.type
    dto.reason = adjustment.reason
    dto.status = adjustment.status
    dto.amount = adjustment.amount
    dto.balanceBefore = adjustment.balanceBefore
    dto.balanceAfter = adjustment.balanceAfter
    dto.comment = adjustment.comment
    dto.executedAt = adjustment.executedAt
    dto.createdAt = adjustment.createdAt
    dto.transaction = adjustment.transaction
    dto.wallet = adjustment.wallet
    dto.admin = adjustment.admin

    return dto
  }

  /**
   * Construit une page de résultats depuis la page projetée par le service.
   *
   * @param {PaginatedWalletAdjustmentsResult} page - Page projetée.
   * @returns {PaginatedWalletAdjustmentsResponseDTO} La page destinée au back-office.
   */
  static fromResultPage(
    page: PaginatedWalletAdjustmentsResult
  ): PaginatedWalletAdjustmentsResponseDTO {
    return {
      data: page.data.map(WalletAdjustmentListItemResponseDTO.fromResult),
      meta: page.meta,
    }
  }
}

export interface PaginatedWalletAdjustmentsResponseDTO {
  data: WalletAdjustmentListItemResponseDTO[]
  meta: WalletAdjustmentsPaginationMeta
}
