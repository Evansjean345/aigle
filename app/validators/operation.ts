import vine from '@vinejs/vine'

const depositDetailsSchema = vine.object({
  amount: vine.number(),
  operation_type: vine.string().trim(),
  operator: vine.string().trim(),
  debiteur_phone: vine.string().trim(),
  pincode: vine.string().trim().optional(),
})

const airtimeDetailsSchema = vine.object({
  amount: vine.number(),
  operation_type: vine.string().trim(),
  beneficiaire_name: vine.string().trim(),
  beneficiaire_phone: vine.string().trim(),
  operator_id: vine.number(),
  country_code: vine.string().trim(),
  pincode: vine.string().trim().optional(),
})

export const airtimeValidator = vine.compile(
  vine.object({
    amount: vine.number(),
    operation_type: vine.string().trim(),
    service: vine.string().trim(),
    deposit_details: depositDetailsSchema,
    airtime_details: airtimeDetailsSchema,
  })
)

export const transfertValidator = vine.compile(
  vine.object({
    amount: vine.number(),
    is_fee: vine.boolean(),
    beneficiaire_phone: vine.string().trim(),
    beneficiaire_name: vine.string().trim(),
    payment_method: vine.string().trim(),
    operator: vine.string().trim(),
    operation_type: vine.string().trim(),
  })
)
