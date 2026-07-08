import vine from '@vinejs/vine'

/**
 * Invitation d'un membre : téléphone de l'invité + rôle à lui attribuer.
 */
export const inviteMemberValidator = vine.compile(
  vine.object({
    phone: vine.string().trim().minLength(6).maxLength(20),
    role_id: vine.number().positive(),
  })
)

/**
 * Changement de rôle d'un membre.
 */
export const changeMemberRoleValidator = vine.compile(
  vine.object({
    role_id: vine.number().positive(),
  })
)

/**
 * Acceptation d'une invitation : code OTP reçu par SMS.
 */
export const acceptInvitationValidator = vine.compile(
  vine.object({
    otp: vine.string().trim().minLength(4).maxLength(8),
  })
)
