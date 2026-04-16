import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AdminDeviceController = () =>
  import('#features/device/presentation/admin/controllers/admin_device_controller')

export default function adminDeviceRoutes() {
  return router
    .group(() => {
      router.get('', [AdminDeviceController, 'getDevices'])
      router.get('/users/:userId', [AdminDeviceController, 'getUserDevices'])
      router.delete('/users/:userId/:deviceId/revoke', [AdminDeviceController, 'revokeDevice'])
      router.get('/:deviceId', [AdminDeviceController, 'getDeviceDetails'])
      router.get('/:deviceId/accounts', [AdminDeviceController, 'getDeviceAccounts'])
      router.get('/:deviceId/transaction-summary', [AdminDeviceController, 'getTransactionSummary'])
      router.get('/:deviceId/transactions', [AdminDeviceController, 'getDeviceTransactions'])
    })
    .prefix('devices')
    .use(middleware.auth({ guards: ['admin'] }))
}
