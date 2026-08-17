import vine from '@vinejs/vine'

export const createPaymentMethodValidator = vine.create(
  vine.object({
    code: vine.string().unique(async (db, value) => {
      const match = await db.from('payment_methods').where('code', value).first()
      return !match
    }),
    label: vine.string().unique(async (db, value) => {
      const match = await db.from('payment_methods').where('label', value).first()
      return !match
    }),
  })
)

export const updatePaymentMethodValidator = vine.create(
  vine.object({
    code: vine.string().unique(async (db, value, field) => {
      const match = await db
        .from('payment_methods')
        .whereNot('id', field.meta.paymentMethodId)
        .where('code', value)
        .first()
      return !match
    }),
    label: vine.string().unique(async (db, value, field) => {
      const match = await db
        .from('payment_methods')
        .whereNot('id', field.meta.paymentMethodId)
        .where('label', value)
        .first()
      return !match
    }),
  })
)

export const paymentMethodValidatorMessage = {
  'code.required': 'Le code est requis',
  'label.required': 'Le libellé est requis',
  'code.database.unique': 'Ce code existe déjà',
  'label.database.unique': 'Ce libellé existe déjà',
}
