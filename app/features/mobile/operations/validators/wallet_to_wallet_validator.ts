import vine from '@vinejs/vine'

export const walletToWalletValidator = vine.compile(
  vine.object({
    token: vine.string(),
    recipient_phone: vine.string(),
    amount: vine.number().positive().min(1),
  })
)
