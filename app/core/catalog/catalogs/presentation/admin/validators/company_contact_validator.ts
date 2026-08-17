import vine from '@vinejs/vine'

export const updateCompanyContactValidator = vine.create(
  vine.object({
    value: vine.string().trim().optional(),
    isActive: vine.boolean().optional(),
  })
)
