import vine from '@vinejs/vine'

export const createPermissionValidator = vine.compile(
  vine.object({
    slug: vine
      .string()
      .trim()
      .unique(async (db, value) => {
        const row = await db.from('permissions').where('slug', value).first()
        return !row
      }),
    name: vine.string().trim(),
    description: vine.string().trim().optional(),
  })
)

export const updatePermissionValidator = vine.compile(
  vine.object({
    name: vine.string().trim().optional(),
    description: vine.string().trim().optional(),
  })
)

export const permissionValidatorErrorMessages = {
  'slug.database.unique': 'Cette permission existe déjà',
  'name.required': 'Le nom de la permission est obligatoire',
  'description.string': 'Description doit être une chaîne de caractères',
}
