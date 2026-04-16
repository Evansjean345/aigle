import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'
import { RefundReason } from '#features/transactions/domain/enums/refund'

const schema = vine.object({
  reference: vine.string().trim().minLength(1),
  reason: vine.enum(Object.values(RefundReason)),
  comment: vine.string().trim().minLength(10).maxLength(1000),
})

export const adminRefundValidator = vine.compile(schema)
export type AdminRefundValidator = Infer<typeof schema>
