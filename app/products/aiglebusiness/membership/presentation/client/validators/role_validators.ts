import vine from '@vinejs/vine'

/**
 * Payload de création d'un rôle. Les slugs de permissions sont validés une
 * seconde fois contre le catalogue dans le use case (source de vérité).
 */
export const createRoleValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(60),
    permission_slugs: vine.array(vine.string().trim()).minLength(1),
  })
)

/**
 * Payload d'édition d'un rôle : nom et/ou permissions, les deux optionnels
 * (mais au moins un doit être fourni).
 */
export const updateRoleValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(60).optional(),
    permission_slugs: vine.array(vine.string().trim()).minLength(1).optional(),
  })
)
