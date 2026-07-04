import type { DateTime } from 'luxon'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type Refund from '#core/transactions/domain/models/refund'
import type {
  RefundReason,
  RefundStatus,
  RefundType,
} from '#core/transactions/domain/enums/refund'

// ── RequestDto (input use case) ─────────────────────────────────────

export interface ListRefundsRequestDto {
  page?: number
  perPage?: number
  walletId?: number
  userId?: string
  adminId?: number
  transactionId?: number
  type?: RefundType
  reason?: RefundReason
  search?: string
  minAmount?: number
  maxAmount?: number
  startDate?: string
  endDate?: string
}

// ── Response (output HTTP) ──────────────────────────────────────────

export class RefundListItemResponseDTO {
  declare id: number
  declare refundUid: string
  declare transactionId: number
  declare walletId: number
  declare type: RefundType
  declare reason: RefundReason
  declare status: RefundStatus
  declare amount: number
  declare feesRefunded: number
  declare totalRefunded: number
  declare comment: string
  declare balanceBefore: number
  declare balanceAfter: number
  declare executedAt: DateTime
  declare createdAt: DateTime
  declare transaction: {
    id: number
    reference: string
    operationType: string
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

  static fromRefund(refund: Refund): RefundListItemResponseDTO {
    const dto = new RefundListItemResponseDTO()
    dto.id = refund.id
    dto.refundUid = refund.refundUid
    dto.transactionId = refund.transactionId
    dto.walletId = refund.walletId
    dto.type = refund.type
    dto.reason = refund.reason
    dto.status = refund.status
    dto.amount = Number(refund.amount)
    dto.feesRefunded = Number(refund.feesRefunded)
    dto.totalRefunded = Number(refund.totalRefunded)
    dto.comment = refund.comment
    dto.balanceBefore = Number(refund.balanceBefore)
    dto.balanceAfter = Number(refund.balanceAfter)
    dto.executedAt = refund.executedAt
    dto.createdAt = refund.createdAt

    const transaction = refund.transaction
    dto.transaction = transaction
      ? {
          id: transaction.id,
          reference: transaction.reference,
          operationType: transaction.operationType,
          user: transaction.user
            ? {
                usersUid: transaction.user.usersUid,
                firstname: transaction.user.firstname,
                lastname: transaction.user.lastname,
              }
            : null,
        }
      : null

    dto.admin = refund.admin
      ? {
          id: refund.admin.id,
          firstname: refund.admin.firstname,
          lastname: refund.admin.lastname,
          email: refund.admin.email,
        }
      : null

    return dto
  }

  static fromPaginator(paginator: ModelPaginatorContract<Refund>): PaginatedRefundsResponseDTO {
    return {
      data: paginator.all().map(RefundListItemResponseDTO.fromRefund),
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

export interface RefundsPaginationMeta {
  total: number
  currentPage: number
  firstPage: number
  lastPage: number
  perPage: number
}

export interface PaginatedRefundsResponseDTO {
  data: RefundListItemResponseDTO[]
  meta: RefundsPaginationMeta
}
