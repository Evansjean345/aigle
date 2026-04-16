import type { DateTime } from 'luxon'
import type Refund from '#features/transactions/domain/models/refund'
import type { RefundReason, RefundStatus, RefundType } from '#features/transactions/domain/enums/refund'

export class AdminRefundResponseDTO {
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
  declare adminId: number | null
  declare balanceBefore: number
  declare balanceAfter: number
  declare executedAt: DateTime
  declare createdAt: DateTime

  static fromRefund(refund: Refund): AdminRefundResponseDTO {
    const dto = new AdminRefundResponseDTO()
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
    dto.adminId = refund.adminId
    dto.balanceBefore = Number(refund.balanceBefore)
    dto.balanceAfter = Number(refund.balanceAfter)
    dto.executedAt = refund.executedAt
    dto.createdAt = refund.createdAt
    return dto
  }
}
