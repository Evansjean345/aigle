import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

const schema = vine.object({
  amount: vine.number(),
  service_type: vine
    .string()
    .trim()
    .exists(async (db, value) =>
      db.from('service_types').select('id').where('code', value).first()
    ),

  // From (debiteur)
  provider_from_id: vine
    .number()
    .exists(async (db, value) => db.from('providers').select('id').where('id', value).first()),
  provider_from_code: vine
    .string()
    .trim()
    .exists(async (db, value) => db.from('providers').select('id').where('code', value).first()),
  payment_method_deposit_code: vine
    .string()
    .exists(async (db, value) =>
      db.from('payment_methods').select('id').where('code', value).first()
    ),
  payment_method_deposit_id: vine
    .number()
    .exists(async (db, value) =>
      db.from('payment_methods').select('id').where('id', value).first()
    ),
  debiteur_phone: vine.string().trim(),
  pin_code: vine.string().optional(),

  // To (beneficiaire)
  provider_to_id: vine
    .number()
    .exists(async (db, value) => db.from('providers').select('id').where('id', value).first()),
  provider_to_code: vine
    .string()
    .trim()
    .exists(async (db, value) => db.from('providers').select('id').where('code', value).first()),
  payment_method_transfert_code: vine
    .string()
    .exists(async (db, value) =>
      db.from('payment_methods').select('id').where('code', value).first()
    ),
  payment_method_transfert_id: vine
    .number()
    .exists(async (db, value) =>
      db.from('payment_methods').select('id').where('id', value).first()
    ),
  beneficiaire_phone: vine.string().trim(),
})

export const interTransfertValidator = vine.compile(schema)
export type InterTransfertValidator = Infer<typeof schema>
