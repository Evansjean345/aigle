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
    birthday: vine.date(),
    lastname: vine.string().trim(),
    email: vine.string().trim().email().optional(),
    phone: vine.string().trim(),
    iso_code: vine.string().trim(),
    pincode: vine.string().trim().minLength(5).maxLength(5),
    // password: vine.string().trim().minLength(5).maxLength(5),
  })
)

export const loginValidator = vine.compile(
  vine.object({
    phone: vine.string().trim(),
    password: vine.string().trim().minLength(5).maxLength(5),
  })
)

export const checkpinValidator = vine.compile(
  vine.object({
    phone: vine.string().trim(),
    pin: vine.string().trim().minLength(5).maxLength(5),
  })
)
