import vine from '@vinejs/vine'

/**
 * Payload du paiement marchand : `code` du QR marchand, montant, et PIN (débit wallet).
 */
export const payMerchantValidator = vine.compile(
  vine.object({
    code: vine.string().trim().minLength(1),
    amount: vine.number().positive().min(1),
    pincode: vine.string().trim().minLength(5).maxLength(5),
  })
)
