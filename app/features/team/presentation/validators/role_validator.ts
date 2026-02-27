import vine from '@vinejs/vine'

export const createRoleValidator = vine.compile(
  vine.object({
    name: vine.string().trim(),
    description: vine.string().trim().optional(),
    permissionIds: vine.array(vine.number()).optional(),
  })
)

export const updateRoleValidator = vine.compile(
  vine.object({
    name: vine.string().trim().optional(),
    description: vine.string().trim().optional(),
    permissionIds: vine.array(vine.number()).optional(),
  })
)
