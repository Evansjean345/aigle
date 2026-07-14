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
  // Mode Orange : payment_link (défaut) ou otp.
  //  - mode `otp` → `otp` requis (saisi par le payeur) ;
  //  - mode `payment_link` (défaut) → aucune URL à fournir : aigle est notre app de paiement
  //    unique, la page de retour est le portail aiglepay (config, cf. use case), pas le client.
  payment_mode: vine.enum(['otp', 'payment_link']).optional(),
  otp: vine.string().trim().optional().requiredWhen('payment_mode', '=', 'otp'),
})

export const initiateCheckoutValidator = vine.create(initiateSchema)
export type InitiateCheckoutValidator = Infer<typeof initiateSchema>
