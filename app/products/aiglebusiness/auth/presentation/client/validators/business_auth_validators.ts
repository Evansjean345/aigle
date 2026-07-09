import vine from '@vinejs/vine'

/** Étape 1 : identifiants (phone + PIN). */
export const businessLoginValidator = vine.compile(
  vine.object({
    phone: vine.string().trim().minLength(6).maxLength(20),
    pincode: vine.string().trim().minLength(4).maxLength(8),
  })
)

/** Étape 2 : OTP de connexion. */
export const businessVerifyLoginValidator = vine.compile(
  vine.object({
    phone: vine.string().trim().minLength(6).maxLength(20),
    otp: vine.string().trim().minLength(4).maxLength(8),
  })
)
