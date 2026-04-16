import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'
import { AdjustmentType, AdjustmentReason } from '#features/wallet/domain/enums/wallet_adjustment'

const schema = vine.object({
  walletId: vine.number().positive(),
  type: vine.enum(Object.values(AdjustmentType)),
  reason: vine.enum(Object.values(AdjustmentReason)),
  amount: vine.number().min(1),
  comment: vine.string().trim().minLength(10).maxLength(2000),
  transactionReference: vine.string().trim().minLength(1).optional(),
})

export const walletAdjustmentValidator = vine.compile(schema)
export type WalletAdjustmentValidator = Infer<typeof schema>
