import vine from '@vinejs/vine'

export const quoteAirtimeValidator = vine.compile(
  vine.object({
    serviceType: vine.string().trim(),
    fromProviderCode: vine.string().trim(),
    toProviderCode: vine.string().trim(),
    amount: vine.number().positive(),
    currency: vine.string().optional(),
  })
)

export const purchaseAirtimeValidator = vine.compile(
  vine.object({
    serviceType: vine.string().trim(),
    fromProviderCode: vine.string().trim(),
    toProviderCode: vine.string().trim(),
    msisdn: vine.string().trim(),
    amount: vine.number().positive(),
    currency: vine.string().optional(),
  })
)
