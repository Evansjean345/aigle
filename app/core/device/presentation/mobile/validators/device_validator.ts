import vine from '@vinejs/vine'

export const updatePushTokenValidator = vine.compile(
  vine.object({
    pushToken: vine.string().trim(),
  })
)
