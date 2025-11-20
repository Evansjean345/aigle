import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DeviceController = () =>
  import('#features/device/presentation/mobile/controllers/device_controller')

const mobileDeviceRoutes = () =>
  router
    .group(() => {
      router.post('/', [DeviceController, 'registerDevice'])
    })
    .prefix('/mobile/devices')
    .use(middleware.auth())

export default mobileDeviceRoutes
