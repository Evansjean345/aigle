import vine from '@vinejs/vine'

export const createRoleValidator = vine.create(
  vine.object({
    name: vine.string().trim(),
    description: vine.string().trim().optional(),
    permissionIds: vine.array(vine.number()).optional(),
  })
)

export const updateRoleValidator = vine.create(
  vine.object({
    name: vine.string().trim().optional(),
    description: vine.string().trim().optional(),
    permissionIds: vine.array(vine.number()).optional(),
  })
)
