import vine from '@vinejs/vine'

export const createServiceProviderMethodValidator = vine.create(
  vine.object({
    serviceTypeId: vine
      .number()
      .withoutDecimals()
      .min(1)
      .exists(async (db, value) => {
        const match = await db.from('service_types').where('id', value).first()
        return !!match
      }),
    paymentMethodId: vine
      .number()
      .withoutDecimals()
      .min(1)
      .exists(async (db, value) => {
        const match = await db.from('payment_methods').where('id', value).first()
        return !!match
      }),
    providerFromId: vine
      .number()
      .withoutDecimals()
      .min(1)
      .exists(async (db, value) => {
        const match = await db.from('providers').where('id', value).first()
        return !!match
      }),
    providerToId: vine
      .number()
      .withoutDecimals()
      .min(1)
      .exists(async (db, value) => {
        if (value === null) return true
        const match = await db.from('providers').where('id', value).first()
        return !!match
      })
      .optional(),
    feeFixed: vine.number().min(0).optional(),
    feePercent: vine.number().min(0).max(100).optional(),
    currency: vine.string().minLength(2).maxLength(6).optional(),
    minAmount: vine.number().min(0).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const updateServiceProviderMethodValidator = vine.create(
  vine.object({
    serviceTypeId: vine
      .number()
      .withoutDecimals()
      .min(1)
      .exists(async (db, value) => {
        const match = await db.from('service_types').where('id', value).first()
        return !!match
      })
      .optional(),
    paymentMethodId: vine
      .number()
      .withoutDecimals()
      .min(1)
      .exists(async (db, value) => {
        const match = await db.from('payment_methods').where('id', value).first()
        return !!match
      })
      .optional(),
    providerFromId: vine
      .number()
      .withoutDecimals()
      .min(1)
      .exists(async (db, value) => {
        const match = await db.from('providers').where('id', value).first()
        return !!match
      })
      .optional(),
    providerToId: vine
      .number()
      .withoutDecimals()
      .min(1)
      .exists(async (db, value) => {
        if (value === null) return true
        const match = await db.from('providers').where('id', value).first()
        return !!match
      })
      .optional()
      .nullable(),
    feeFixed: vine.number().min(0).optional(),
    feePercent: vine.number().min(0).max(100).optional(),
    currency: vine.string().minLength(2).maxLength(6).optional(),
    minAmount: vine.number().min(0).optional(),
    isActive: vine.boolean().optional(),
  })
)

export const serviceProviderMethodValidatorMessage = {
  'serviceTypeId.required': 'Le type de service est requis',
  'serviceTypeId.number': 'Le type de service doit être un nombre',
  'serviceTypeId.database.exists': "Le type de service n'existe pas",

  'paymentMethodId.required': 'La méthode de paiement est requise',
  'paymentMethodId.number': 'La méthode de paiement doit être un nombre',
  'paymentMethodId.database.exists': "La méthode de paiement n'existe pas",

  'providerFromId.required': 'Le provider source est requis',
  'providerFromId.number': 'Le provider source doit être un nombre',
  'providerFromId.database.exists': "Le provider source n'existe pas",

  'providerToId.number': 'Le provider destination doit être un nombre',
  'providerToId.database.exists': "Le provider destination n'existe pas",

  'feeFixed.number': 'Les frais fixes doivent être un nombre',
  'feeFixed.min': 'Les frais fixes ne peuvent pas être négatifs',
  'feePercent.number': 'Le pourcentage des frais doit être un nombre',
  'feePercent.min': 'Le pourcentage des frais doit être supérieur ou égal à 0',
  'feePercent.max': 'Le pourcentage des frais doit être inférieur ou égal à 100',
  'currency.string': 'La devise doit être une chaîne',
  'currency.minLength': 'La devise est trop courte',
  'currency.maxLength': 'La devise est trop longue',
  'minAmount.number': 'Le montant minimum doit être un nombre',
  'minAmount.min': 'Le montant minimum ne peut pas être négatif',
  'isActive.boolean': "Le champ 'isActive' doit être un booléen",
}
