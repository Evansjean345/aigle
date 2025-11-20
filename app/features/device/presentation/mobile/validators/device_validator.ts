import vine from '@vinejs/vine'

export const registerDevicePayloadSchema = vine.object({
  token: vine.string(),
  devine_name: vine.string().optional(),
  android_version: vine.string().optional(),
  ios_version: vine.string().optional(),
  platform: vine.string().optional(),
  platform_version: vine.string().optional(),
  app_version: vine.string().optional(),
})

export const registerDeviceValidator = vine.compile(registerDevicePayloadSchema)
