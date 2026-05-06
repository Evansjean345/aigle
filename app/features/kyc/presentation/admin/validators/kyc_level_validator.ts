import vine from '@vinejs/vine'

/**
 * Validateur pour la création d'un niveau KYC
 */
export const createKycLevelValidator = vine.compile(
  vine.object({
    level: vine.number().positive(),
    singleLimit: vine.number().min(0),
    dailyLimit: vine.number().min(0),
    monthlyLimit: vine.number().min(0),
    balanceLimit: vine.number().min(0),
    isActive: vine.boolean().optional(),
    isArchived: vine.boolean().optional(),
  })
)

/**
 * Validateur pour la mise à jour d'un niveau KYC
 */
export const updateKycLevelValidator = vine.compile(
  vine.object({
    level: vine.number().positive().optional(),
    singleLimit: vine.number().min(0).optional(),
    dailyLimit: vine.number().min(0).optional(),
    monthlyLimit: vine.number().min(0).optional(),
    balanceLimit: vine.number().min(0).optional(),
    isActive: vine.boolean().optional(),
    isArchived:vine.boolean().optional(),
  })
)

export const kycLevelErrorMessages = {
  'level.required': 'Le niveau est obligatoire',
  'level.number': 'Le niveau doit être un nombre',
  'singleLimit.required': 'La limite par transaction est obligatoire',
  'dailyLimit.required': 'La limite journalière est obligatoire',
  'monthlyLimit.required': 'La limite mensuelle est obligatoire',
  'balanceLimit.required': 'Le plafond du solde est obligatoire',
}
