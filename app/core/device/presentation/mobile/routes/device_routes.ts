import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DeviceController = () =>
  import('#core/device/presentation/mobile/controllers/device_controller')
const AppVersionController = () =>
  import('#core/device/presentation/mobile/controllers/app_version_controller')

// Mobile Device Routes
export default function mobileDeviceRoutes() {
  return router
    .group(() => {
      // Public routes
      router.get('check-updates', [AppVersionController, 'check'])

      // Protected routes (authentication + device middleware required)
      router
        .group(() => {
          router.get('/', [DeviceController, 'getUserDevices'])
          router.put('push-token', [DeviceController, 'updatePushToken'])
          router.delete('/:id/revoke', [DeviceController, 'revokeDevice'])
        })
        .use([middleware.auth(), middleware.device()])
    })
    .prefix('mobile/devices')
}
