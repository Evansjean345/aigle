import vine from '@vinejs/vine'

export const walletToWalletValidator = vine.create(
  vine.object({
    token: vine.string().optional(),
    recipient_phone: vine.string().optional(),
    amount: vine.number().positive().min(1),
    pincode: vine.string().trim().minLength(5).maxLength(5),
  })
)
