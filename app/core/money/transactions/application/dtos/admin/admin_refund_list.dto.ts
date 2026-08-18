import type { DateTime } from 'luxon'
import type { ModelPaginatorContract } from '@adonisjs/lucid/types/model'
import type Refund from '#core/money/transactions/domain/models/refund'
import type {
  RefundReason,
  RefundStatus,
  RefundType,
} from '#core/money/transactions/domain/enums/refund'
import type { AccountHolderResult } from '#core/money/transactions/application/dtos/account_holder.dto'

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
  /** Nom de tri déclaré dans `refundSorts`. Sans lui, l'ordre par défaut du dépôt. */
  sortBy?: string
  order?: 'asc' | 'desc'
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
    party: {
      accountId: string
      type: 'user' | 'organisation' | 'unknown'
      name: string | null
      /** Présent uniquement pour un compte utilisateur. */
      userId?: string
    }
  } | null
  declare admin: {
    id: number
    firstname: string
    lastname: string
    email: string
  } | null

  /**
   * Projette un remboursement pour la liste d'administration.
   *
   * @param {Refund} refund - Remboursement à projeter.
   * @param {Map<string, AccountHolderResult>} [holders] - Titulaires résolus par `account_id`. Sans
   *   eux, la partie prenante reste inconnue.
   */
  static fromRefund(
    refund: Refund,
    holders?: Map<string, AccountHolderResult>
  ): RefundListItemResponseDTO {
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

    if (transaction) {
      const holder = holders?.get(transaction.accountId)
      const fullName = holder?.user
        ? `${holder.user.firstname ?? ''} ${holder.user.lastname ?? ''}`.trim()
        : null

      dto.transaction = {
        id: transaction.id,
        reference: transaction.reference,
        operationType: transaction.operationType,
        party: holder?.user
          ? {
              accountId: transaction.accountId,
              type: 'user',
              name: fullName || null,
              userId: holder.user.userId,
            }
          : {
              accountId: transaction.accountId,
              type: holder?.merchantName ? 'organisation' : 'unknown',
              name: holder?.merchantName ?? null,
            },
      }
    } else {
      dto.transaction = null
    }

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

  static fromPaginator(
    paginator: ModelPaginatorContract<Refund>,
    holders?: Map<string, AccountHolderResult>
  ): PaginatedRefundsResponseDTO {
    return {
      data: paginator.all().map((refund) => RefundListItemResponseDTO.fromRefund(refund, holders)),
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
