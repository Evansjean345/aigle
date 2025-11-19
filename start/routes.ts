import router from '@adonisjs/core/services/router'

import mobileAuthRoutes from '#features/authentication/presentation/mobile/routes/auth_routes'
import mobileWalletRoutes from '#features/wallet/presentation/mobile/routes/wallet_routes'
import mobileServicesRoutes from '#mobile/services/routes/services_routes'
import adminServicesManagementRoutes from '#features/fees/presentation/admin/routes/services_management_routes'
import mobileOperationRoutes from '#features/operations/presentation/mobile/routes/operation_routes'
import mobileWebhookRoutes from '#features/webhooks/presentation/mobile/routes/webhook_routes'
import mobileTransactionRoutes from '#features/transactions/presentation/mobile/routes/transaction_routes'
import mobileDeviceRoutes from '#features/device/presentation/mobile/routes/device_routes'
import mobileProfileRoutes from '#features/profile/presentation/mobile/routes/profile_routes'
import mobileQrRoutes from '#features/qr/presentation/mobile/routes/qr_routes'
import mobileAirtimeRoutes from '#features/airtime/presentation/mobile/routes/airtime_routes'

router
  .group(() => {
    router.group(mobileAuthRoutes)
    router.group(mobileWalletRoutes)
    router.group(mobileServicesRoutes)
    router.group(mobileOperationRoutes)
    router.group(mobileWebhookRoutes)
    router.group(mobileTransactionRoutes)
    router.group(adminServicesManagementRoutes)
    router.group(mobileDeviceRoutes)
    router.group(mobileProfileRoutes)
    router.group(mobileQrRoutes)
    router.group(mobileAirtimeRoutes)
  })
  .prefix('/api')
