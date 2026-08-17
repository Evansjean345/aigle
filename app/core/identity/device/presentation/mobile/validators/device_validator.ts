import vine from '@vinejs/vine'

export const updatePushTokenValidator = vine.create(
  vine.object({
    pushToken: vine.string().trim(),
  })
)
