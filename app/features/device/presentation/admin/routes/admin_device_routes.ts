import router from '@adonisjs/core/services/router'

const AdminDeviceController = () =>
  import('#features/device/presentation/admin/controllers/admin_device_controller')

export default function adminDeviceRoutes() {
  return router
    .group(() => {
      router.get('/users/:userId', [AdminDeviceController, 'getUserDevices'])
      router.delete('/users/:userId/:deviceId/revoke', [AdminDeviceController, 'revokeDevice'])
    })
    .prefix('devices')
}
