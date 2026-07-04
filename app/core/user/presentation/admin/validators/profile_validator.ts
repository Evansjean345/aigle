import vine from '@vinejs/vine'

export const changePasswordValidator = vine.compile(
  vine.object({
    old_pincode: vine.string().trim().minLength(5).maxLength(5),
    new_pincode: vine.string().trim().minLength(5).maxLength(5),
    confirm_pincode: vine.string().trim().minLength(5).maxLength(5).sameAs('new_pincode'),
  })
)
