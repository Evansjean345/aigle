import vine from '@vinejs/vine'

/** Étape 0 : vérification du numéro (user Aigle KYC-vérifié). */
export const businessCheckPhoneValidator = vine.compile(
  vine.object({
    phone: vine.string().trim().minLength(6).maxLength(20),
  })
)

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
  // Absent des clients antérieurs : leur empreinte reste d'origine inconnue.
  identity: vine.enum(['strong', 'weak']).optional(),
  hardware_key: vine.string().trim().optional(),
})

/** Étape 1 : identifiants (phone + PIN) + appareil optionnel (mobile business). */
export const businessLoginValidator = vine.create(
  vine.object({
    phone: vine.string().trim().minLength(6).maxLength(20),
    pincode: vine.string().trim().minLength(4).maxLength(8),
    device_info: deviceInfoSchema.optional(),
  })
)

/**
 * Étape 2 : OTP de connexion. L'appareil (mobile business) passe par les **headers**
 * device (`X-Device-Fingerprint`, `X-Device-Uid`), pas par le body.
 */
export const businessVerifyLoginValidator = vine.create(
  vine.object({
    phone: vine.string().trim().minLength(6).maxLength(20),
    otp: vine.string().trim().minLength(4).maxLength(8),
  })
)

/**
 * Vérification du PIN (déverrouillage / lock-screen) d'un utilisateur **déjà
 * authentifié**. Seul le PIN transite ; le numéro vient du token. PIN à 5 chiffres
 * (aligné sur le lock-screen mobile et le `checkPinValidator` aiglesend).
 */
export const businessCheckPinValidator = vine.create(
  vine.object({
    pincode: vine.string().trim().minLength(5).maxLength(5),
  })
)
