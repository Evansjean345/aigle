import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const BusinessDeviceController = () =>
  import('#aiglebusiness/device/presentation/client/controllers/business_device_controller')

/**
 * Appareil (canal client business). Même chaîne de middleware que les autres routes
 * business authentifiées : canal + auth + app `aiglebusiness` + appareil de confiance.
 * Le token push est ainsi enregistré pour l'appareil de l'app business (miroir du flux
 * aiglesend `PUT /mobile/devices/push-token`).
 */
export default function businessDeviceRoutes() {
  router
    .group(() => {
      router.put('devices/push-token', [BusinessDeviceController, 'updatePushToken'])
    })
    .prefix('business')
    .use([
      middleware.geoip(),
      middleware.businessChannel(),
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
      middleware.businessDevice(),
    ])
}
