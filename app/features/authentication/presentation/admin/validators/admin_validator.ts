import vine from '@vinejs/vine'

export const adminLoginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email(),
    password: vine.string().trim().minLength(8),
  })
)

export const adminRefreshTokenValidator = vine.compile(
  vine.object({
    refresh_token: vine.string().trim(),
  })
)
