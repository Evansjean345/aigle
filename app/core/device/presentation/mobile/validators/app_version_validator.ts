import vine from '@vinejs/vine'
import { DeviceType } from '#core/device/domain/enums'

/**
 * Validateur pour la vérification de mise à jour (Mobile)
 */
export const checkUpdateValidator = vine.compile(
  vine.object({
    platform: vine.enum(DeviceType),
    version: vine.string(),
  })
)
