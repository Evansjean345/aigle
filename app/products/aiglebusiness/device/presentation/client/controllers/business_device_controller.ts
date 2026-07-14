import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DeviceService from '#core/identity/device/application/services/device_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import User from '#core/identity/user/domain/models/user'
import { updateBusinessPushTokenValidator } from '#aiglebusiness/device/presentation/client/validators/update_push_token_validator'

/**
 * Appareil (canal business). Présentation **mince** : l'appareil est déjà identifié et
 * vérifié de confiance par le middleware `businessDevice` ; on délègue la persistance au
 * **service core** `DeviceService` (le produit ne connaît pas le stockage device).
 *
 * Le token push est rattaché à la liaison user↔device **scopée `aiglebusiness`** — miroir
 * du flux aiglesend (`PUT /mobile/devices/push-token`), mais pour le token de cette app,
 * afin que le scoping des notifications route bien vers l'app business.
 */
@inject()
export default class BusinessDeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  /** PUT /api/business/devices/push-token — enregistre/actualise le token push de l'appareil. */
  async updatePushToken({ request, response, auth, deviceInfo }: HttpContext): Promise<void> {
    const payload = await request.validateUsing(updateBusinessPushTokenValidator)
    const user = auth.user! as User

    const fingerprintHash = deviceInfo?.fingerprintHash
    const deviceUid = deviceInfo?.deviceUid

    if (!fingerprintHash || !deviceUid) {
      return response.badRequest({
        message: 'Fingerprint and Device UID are required in headers',
        code: 'DEVICE_IDENTIFIERS_REQUIRED',
      })
    }

    const userDevice = await this.deviceService.updatePushToken(
      fingerprintHash,
      deviceUid,
      payload.pushToken,
      user.usersUid,
      AppName.AIGLEBUSINESS
    )

    return response.ok({
      userDeviceId: userDevice.id,
      pushToken: userDevice.pushToken,
    })
  }
}
