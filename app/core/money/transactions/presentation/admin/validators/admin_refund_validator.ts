import vine from '@vinejs/vine'
import { RefundReason, RefundType } from '#core/money/transactions/domain/enums/refund'

const schema = vine.object({
  reference: vine.string().trim().minLength(1),
  reason: vine.enum(Object.values(RefundReason)),
  comment: vine.string().trim().minLength(10).maxLength(1000),
})

export const adminRefundValidator = vine.compile(schema)

const transactionsRefundListSchema = vine.object({
  page: vine.number().positive().optional(),
  perPage: vine.number().positive().max(200).optional(),
  walletId: vine.number().positive().optional(),
  userId: vine.string().trim().uuid().optional(),
  adminId: vine.number().positive().optional(),
  type: vine.enum(Object.values(RefundType)).optional(),
  reason: vine.enum(Object.values(RefundReason)).optional(),
  search: vine.string().trim().minLength(1).maxLength(200).optional(),
  minAmount: vine.number().min(0).optional(),
  maxAmount: vine.number().min(0).optional(),
  startDate: vine.string().trim().optional(),
  endDate: vine.string().trim().optional(),
})

export const transactionsRefundListValidator = vine.compile(transactionsRefundListSchema)
