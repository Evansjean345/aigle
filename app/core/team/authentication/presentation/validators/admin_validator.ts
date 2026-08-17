import vine from '@vinejs/vine'

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/

const strongPassword = () =>
  vine.string().trim().minLength(8).maxLength(128).regex(STRONG_PASSWORD_REGEX)

export const adminLoginValidator = vine.create(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string().trim().minLength(8).maxLength(128),
  })
)

export const adminRefreshTokenValidator = vine.create(
  vine.object({
    refresh_token: vine.string().trim(),
  })
)

export const setupAdminPasswordValidator = vine.create(
  vine.object({
    token: vine.string().trim(),
    password: strongPassword(),
  })
)

export const verifyAdminOtpValidator = vine.create(
  vine.object({
    email: vine.string().trim().email(),
    otp: vine.string().trim(),
  })
)
