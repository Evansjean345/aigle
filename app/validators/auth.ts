import vine from '@vinejs/vine'

export const createPostValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(6),
    slug: vine.string().trim(),
    description: vine.string().trim().escape(),
  })
)

export const registerValidator = vine.compile(
  vine.object({
    firstname: vine.string().trim(),
    lastname: vine.string().trim(),
    birthday: vine.date().optional(),
    email: vine.string().trim().email().optional(),
    phone: vine.string().trim(),
    pincode: vine.string().trim().minLength(5).maxLength(5),
    country_id: vine.number().exists(async (db, value) => {
      const row = await db.from('countries').where('id', value).first()
      return !!row
    }),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    phone: vine.string().trim(),
    codepin: vine.string().trim().minLength(5).maxLength(5),
    country_id: vine.number().exists(async (db, value) => {
      const row = await db.from('countries').where('id', value).first()
      return !!row
    }),
  })
)

export const verifyUserAccountValidator = vine.compile(
  vine.object({
    phone: vine.string().trim(),
    otp: vine.string().trim().minLength(4).maxLength(4),
    country_id: vine.number().exists(async (db, value) => {
      const row = await db.from('countries').where('id', value).first()
      return !!row
    }),
  })
)

export const checkPinValidator = vine.compile(
  vine.object({
    pincode: vine.string().trim().minLength(5).maxLength(5),
  })
)

export const checkPhoneValidator = vine.compile(
  vine.object({
    phone: vine.string().trim(),
    country_id: vine.number().exists(async (db, value) => {
      const row = await db.from('countries').where('id', value).first()
      return !!row
    }),
  })
)
