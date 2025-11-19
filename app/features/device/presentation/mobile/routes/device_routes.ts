import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DeviceController = () => import('../controllers/device_controller.js')
const PushNotificationController = () => import('../controllers/push_notification_controller.js')

const mobileDeviceRoutes = () =>
  router
    .group(() => {
      router.post('/', [DeviceController, 'registerDevice'])
      router.post('/notification', [PushNotificationController, 'handle'])
    })
    .prefix('/mobile/devices')
    .use(middleware.auth())

export default mobileDeviceRoutes
