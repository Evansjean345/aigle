import vine from '@vinejs/vine'

export const storeDebitPhoneValidator = vine.create(
  vine.object({
    phone: vine.string().trim(),
    providerCode: vine.string().trim(),
    label: vine.string().trim().optional(),
  })
)

export const verifyDebitPhoneValidator = vine.create(
  vine.object({
    phone: vine.string().trim(),
    codeOtp: vine.string().trim(),
  })
)

export const resendDebitPhoneOtpValidator = vine.create(
  vine.object({
    phone: vine.string().trim(),
    providerCode: vine.string().trim(),
  })
)
