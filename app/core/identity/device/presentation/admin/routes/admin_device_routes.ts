import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { DEVICE_PERMISSIONS } from '#core/identity/device/presentation/admin/permissions.config'

const AdminDeviceController = () =>
  import('#core/identity/device/presentation/admin/controllers/admin_device_controller')

export default function adminDeviceRoutes() {
  return router
    .group(() => {
      router
        .get('', [AdminDeviceController, 'getDevices'])
        .use(middleware.permission([DEVICE_PERMISSIONS.devicesRead]))

      router
        .get('/users/:userId', [AdminDeviceController, 'getUserDevices'])
        .use(middleware.permission([DEVICE_PERMISSIONS.devicesRead]))

      router
        .delete('/users/:userId/:deviceId/revoke', [AdminDeviceController, 'revokeDevice'])
        .use(middleware.permission([DEVICE_PERMISSIONS.deviceRevoke]))

      router
        .get('/:deviceId', [AdminDeviceController, 'getDeviceDetails'])
        .use(middleware.permission([DEVICE_PERMISSIONS.deviceRead]))

      router
        .get('/:deviceId/accounts', [AdminDeviceController, 'getDeviceAccounts'])
        .use(middleware.permission([DEVICE_PERMISSIONS.deviceRead]))

      router
        .get('/:deviceId/transaction-summary', [AdminDeviceController, 'getTransactionSummary'])
        .use(middleware.permission([DEVICE_PERMISSIONS.deviceRead]))

      router
        .get('/:deviceId/transactions', [AdminDeviceController, 'getDeviceTransactions'])
        .use(middleware.permission([DEVICE_PERMISSIONS.deviceRead]))
    })
    .prefix('devices')
    .use(middleware.auth({ guards: ['admin'] }))
}
