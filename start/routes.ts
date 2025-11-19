import router from '@adonisjs/core/services/router'

import mobileAuthRoutes from '#mobile/authentication/routes/auth_routes'
import mobileWalletRoutes from '#mobile/wallet/routes/wallet_routes'
import mobileServicesRoutes from '#mobile/services/routes/services_routes'
import adminServicesManagementRoutes from '#admin/services_management/routes/services_management_routes'
import mobileOperationRoutes from '#mobile/operations/routes/operation_routes'
import mobileWebhookRoutes from '#mobile/webhooks/routes/webhook_routes'
import mobileTransactionRoutes from '#mobile/transactions/routes/transaction_routes'
import mobileDeviceRoutes from '#mobile/device/routes/device_routes'
import mobileProfileRoutes from '#mobile/profile/routes/profile_routes'
import mobileQrRoutes from '#mobile/qr/routes/qr_routes'
import mobileAirtimeRoutes from '#mobile/airtime/routes/airtime_routes'

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
