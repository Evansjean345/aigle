import vine from '@vinejs/vine'
import { Infer } from '@vinejs/vine/types'

const operationSchema = vine.object({
  phone: vine.string().trim(),
  provider_code: vine
    .string()
    .trim()
    .exists(async (db, value) => db.from('providers').select('id').where('code', value).first()),
  provider_id: vine
    .number()
    .exists(async (db, value) => db.from('providers').select('id').where('id', value).first()),
  payment_method_code: vine
    .string()
    .exists(async (db, value) =>
      db.from('payment_methods').select('id').where('code', value).first()
    ),
  payment_method_id: vine
    .number()
    .exists(async (db, value) =>
      db.from('payment_methods').select('id').where('id', value).first()
    ),
})

const schema = vine.object({
  amount: vine.number(),
  service_type: vine
    .string()
    .trim()
    .exists(async (db, value) =>
      db.from('service_types').select('id').where('code', value).first()
    ),
  include_fees: vine.boolean().optional(),
  debitaire: vine.object({
    ...operationSchema.getProperties(),
    pincode: vine.string().optional().requiredWhen('provider_code', '=', 'orange'),
  }),

  beneficiaire: vine.object({
    ...operationSchema.getProperties(),
  }),
})

export const interTransfertValidator = vine.compile(schema)
export type InterTransfertValidator = Infer<typeof schema>
