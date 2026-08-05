import { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DeviceService from '#core/identity/device/application/services/device_service'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import User from '#core/identity/user/domain/models/user'
import { updateBusinessPushTokenValidator } from '#aiglebusiness/device/presentation/client/validators/update_push_token_validator'
import ListBusinessDevicesUseCase from '#aiglebusiness/device/application/use_cases/list_business_devices.use_case'

/**
 * Appareils du canal business : liste et token push. Présentation **mince**, tout est délégué
 * au service core (le produit ne connaît pas le stockage device).
 *
 * Le token push est rattaché à la liaison user↔device **scopée `aiglebusiness`** — miroir du
 * flux aiglesend (`PUT /mobile/devices/push-token`), afin que le scoping des notifications
 * route bien vers l'app business.
 *
 * La liste ne porte que les appareils de cette app. Une session web n'a pas d'appareil : elle
 * relève de `GET business/auth/sessions`.
 */
@inject()
export default class BusinessDeviceController {
  constructor(
    private readonly deviceService: DeviceService,
    private readonly listDevices: ListBusinessDevicesUseCase
  ) {}

  /**
   * GET /api/business/devices — les appareils liés au compte business.
   *
   * Ce sont eux qui occupent le quota d'appareils. Accessible depuis le web, sans en-têtes
   * d'appareil : retirer un téléphone perdu se fait rarement depuis ce téléphone.
   */
  async index({ auth, response, deviceInfo }: HttpContext): Promise<void> {
    const user = auth.user! as User

    const devices = await this.listDevices.execute(
      user.usersUid,
      deviceInfo?.fingerprintHash || undefined
    )

    return response.ok(devices)
  }

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
