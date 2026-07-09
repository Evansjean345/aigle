import vine from '@vinejs/vine'

/**
 * Appareil (mobile business) — optionnel. Fourni à l'étape login → enregistré
 * (PENDING) ; fourni à l'étape verify → trusté. Scopé `app='aiglebusiness'`.
 * Absent sur le portail web.
 */
const deviceInfoSchema = vine.object({
  fingerprint_hash: vine.string().trim(),
  device_uid: vine.string().trim(),
  platform: vine.string().trim().optional(),
  brand: vine.string().trim().optional(),
  model: vine.string().trim().optional(),
  os_version: vine.string().trim().optional(),
  app_version: vine.string().trim().optional(),
  is_emulator: vine.boolean(),
  is_rooted: vine.boolean(),
})

/** Étape 1 : identifiants (phone + PIN) + appareil optionnel (mobile business). */
export const businessLoginValidator = vine.compile(
  vine.object({
    phone: vine.string().trim().minLength(6).maxLength(20),
    pincode: vine.string().trim().minLength(4).maxLength(8),
    device_info: deviceInfoSchema.optional(),
  })
)

/** Étape 2 : OTP de connexion (+ appareil optionnel pour le mobile business). */
export const businessVerifyLoginValidator = vine.compile(
  vine.object({
    phone: vine.string().trim().minLength(6).maxLength(20),
    otp: vine.string().trim().minLength(4).maxLength(8),
    device_info: deviceInfoSchema.optional(),
  })
)
