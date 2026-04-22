import type { DateTime } from 'luxon'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type WalletAdjustment from '#features/wallet/domain/models/wallet_adjustment'
import type {
  AdjustmentType,
  AdjustmentReason,
} from '#features/wallet/domain/enums/wallet_adjustment'

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

  static fromAdjustment(adjustment: WalletAdjustment): WalletAdjustmentListItemResponseDTO {
    const dto = new WalletAdjustmentListItemResponseDTO()
    dto.id = adjustment.id
    dto.adjustmentUid = adjustment.adjustmentUid
    dto.walletId = adjustment.walletId
    dto.type = adjustment.type
    dto.reason = adjustment.reason
    dto.status = adjustment.status
    dto.amount = Number(adjustment.amount)
    dto.balanceBefore = Number(adjustment.balanceBefore)
    dto.balanceAfter = Number(adjustment.balanceAfter)
    dto.comment = adjustment.comment
    dto.executedAt = adjustment.executedAt
    dto.createdAt = adjustment.createdAt

    dto.transaction = adjustment.transaction
      ? {
          id: adjustment.transaction.id,
          reference: adjustment.transaction.reference,
        }
      : null

    dto.wallet = adjustment.wallet
      ? {
          id: adjustment.wallet.id,
          walletsUid: adjustment.wallet.walletsUid,
          currencySymbol: adjustment.wallet.currencySymbol,
          user: adjustment.wallet.user
            ? {
                usersUid: adjustment.wallet.user.usersUid,
                firstname: adjustment.wallet.user.firstname,
                lastname: adjustment.wallet.user.lastname,
              }
            : null,
        }
      : null

    const admin = (adjustment as any).admin
    dto.admin = admin
      ? {
          id: admin.id,
          firstname: admin.firstname,
          lastname: admin.lastname,
          email: admin.email,
        }
      : null

    return dto
  }

  static fromPaginator(
    paginator: ModelPaginatorContract<WalletAdjustment>
  ): PaginatedWalletAdjustmentsResponseDTO {
    return {
      data: paginator.all().map(WalletAdjustmentListItemResponseDTO.fromAdjustment),
      meta: {
        total: paginator.total,
        currentPage: paginator.currentPage,
        firstPage: paginator.firstPage,
        lastPage: paginator.lastPage,
        perPage: paginator.perPage,
      },
    }
  }
}

export interface WalletAdjustmentsPaginationMeta {
  total: number
  currentPage: number
  firstPage: number
  lastPage: number
  perPage: number
}

export interface PaginatedWalletAdjustmentsResponseDTO {
  data: WalletAdjustmentListItemResponseDTO[]
  meta: WalletAdjustmentsPaginationMeta
}