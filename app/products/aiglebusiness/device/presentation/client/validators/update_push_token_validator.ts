import vine from '@vinejs/vine'

/**
 * Enregistrement du token push (canal business). L'appareil est identifié par les
 * en-têtes `X-Device-*` (middleware `businessDevice`) ; seul le token est dans le corps.
 */
export const updateBusinessPushTokenValidator = vine.create(
  vine.object({
    pushToken: vine.string().trim(),
  })
)
