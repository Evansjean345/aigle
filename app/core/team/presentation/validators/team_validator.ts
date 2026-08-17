import vine from '@vinejs/vine'

export const createAdminValidator = vine.create(
  vine.object({
    firstname: vine.string().trim(),
    lastname: vine.string().trim(),
    email: vine
      .string()
      .trim()
      .email()
      .unique(async (db, value) => {
        const row = await db.from('admins').where('email', value).first()
        return !row
      }),
    roleId: vine.number().optional(),
  })
)

export const updateAdminValidator = vine.create(
  vine.object({
    firstname: vine.string().trim().optional(),
    lastname: vine.string().trim().optional(),
    email: vine.string().trim().email().optional(),
    roleId: vine.number().optional(),
  })
)
