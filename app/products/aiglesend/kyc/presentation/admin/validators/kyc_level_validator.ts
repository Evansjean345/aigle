import vine from '@vinejs/vine'

/**
 * Ajustement des montants d'un palier.
 *
 * Ni `segment` ni `level` : le couple identifie le palier et porte sa signification en code.
 * Un montant nul signifie **illimité** — c'est ainsi que la grille exprime l'absence de plafond.
 */
export const updateKycLevelValidator = vine.compile(
  vine.object({
    singleLimit: vine.number().min(0).nullable().optional(),
    dailyLimit: vine.number().min(0).nullable().optional(),
    monthlyLimit: vine.number().min(0).nullable().optional(),
    balanceLimit: vine.number().min(0).nullable().optional(),
  })
)

export const kycLevelErrorMessages = {
  'singleLimit.number': 'La limite par transaction doit être un nombre',
  'dailyLimit.number': 'La limite journalière doit être un nombre',
  'monthlyLimit.number': 'La limite mensuelle doit être un nombre',
  'balanceLimit.number': 'Le plafond du solde doit être un nombre',
  'singleLimit.min': 'La limite par transaction ne peut pas être négative',
  'dailyLimit.min': 'La limite journalière ne peut pas être négative',
  'monthlyLimit.min': 'La limite mensuelle ne peut pas être négative',
  'balanceLimit.min': 'Le plafond du solde ne peut pas être négatif',
}
