import vine from '@vinejs/vine'
import { type Infer } from '@vinejs/vine/types'

/**
 * Payload d'initiation d'un checkout public. Le payeur (anonyme) fournit le montant
 * + son moyen mobile money. Les codes provider/moyen sont vérifiés contre le catalogue.
 */
const initiateSchema = vine.object({
  amount: vine.number().positive(),
  provider_code: vine
    .string()
    .trim()
    .exists(async (db, value) => db.from('providers').select('id').where('code', value).first()),
  payment_method_code: vine
    .string()
    .trim()
    .exists(async (db, value) =>
      db.from('payment_methods').select('id').where('code', value).first()
    ),
  phone: vine.string().trim(),
  country: vine.string().trim(),
  // Mode Orange : payment_link (défaut) ou otp. Redirection : success/error url.
  payment_mode: vine.enum(['otp', 'payment_link']).optional(),
  otp: vine.string().trim().optional(),
  success_url: vine.string().trim().url().optional(),
  error_url: vine.string().trim().url().optional(),
})

export const initiateCheckoutValidator = vine.create(initiateSchema)
export type InitiateCheckoutValidator = Infer<typeof initiateSchema>
