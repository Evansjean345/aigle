import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DeviceController = () => import('#mobile/device/controllers/device_controller')
const PushNotificationController = () =>
  import('#mobile/device/controllers/push_notification_controller')

const mobileDeviceRoutes = () =>
  router
    .group(() => {
      router.post('/', [DeviceController, 'registerDevice'])
      router.post('/notification', [PushNotificationController, 'handle'])
    })
    .prefix('/mobile/devices')
    .use(middleware.auth())

export default mobileDeviceRoutes
