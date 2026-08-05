import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const BusinessDeviceController = () =>
  import('#aiglebusiness/device/presentation/client/controllers/business_device_controller')

/**
 * Appareils (canal client business). Même chaîne de middleware que les autres routes
 * business authentifiées : canal + auth + app `aiglebusiness` + appareil de confiance.
 *
 * `businessDevice` n'exige les en-têtes d'appareil qu'en canal mobile : la liste reste donc
 * consultable depuis le web, ce qui est le cas d'usage quand l'appareil à retirer est perdu.
 */
export default function businessDeviceRoutes() {
  router
    .group(() => {
      router.get('devices', [BusinessDeviceController, 'index'])
      router.put('devices/push-token', [BusinessDeviceController, 'updatePushToken'])
      router.delete('devices/:id', [BusinessDeviceController, 'destroy'])
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
