import router from '@adonisjs/core/services/router'

const HealthController = () => import('#shared/infrastructure/controllers/health_controller')

import mobileAuthRoutes from '#features/authentication/presentation/mobile/routes/auth_routes'
import mobileWalletRoutes from '#features/wallet/presentation/mobile/routes/wallet_routes'
import mobileServicesRoutes from '#features/catalogs/presentation/mobile/routes/services_routes'
import mobileOperationRoutes from '#features/operations/presentation/mobile/routes/operation_routes'
import mobileWebhookRoutes from '#features/webhooks/presentation/mobile/routes/webhook_routes'
import providerWebhookRoutes from '#features/webhooks/presentation/provider/routes/provider_webhook_routes'
import mobileTransactionRoutes from '#features/transactions/presentation/mobile/routes/transaction_routes'
import userAccountMobileRoutes from '#features/user/presentation/mobile/routes/profile_routes'
import mobileQrRoutes from '#features/qr/presentation/mobile/routes/qr_routes'
import mobileKycRoutes from '#features/kyc/presentation/mobile/routes/kyc_routes'
import mobileDeviceRoutes from '#features/device/presentation/mobile/routes/device_routes'
import mobileDebitPhoneRoutes from '#features/user/presentation/mobile/routes/debit_phone_routes'

router
  .group(() => {
    router.group(mobileAuthRoutes)
    router.group(mobileWalletRoutes)
    router.group(mobileServicesRoutes)
    router.group(mobileOperationRoutes)
    router.group(mobileWebhookRoutes)
    router.group(providerWebhookRoutes)
    router.group(mobileTransactionRoutes)
    router.group(userAccountMobileRoutes)
    router.group(mobileQrRoutes)
    router.group(mobileKycRoutes)
    router.group(mobileDeviceRoutes)
    router.group(mobileDebitPhoneRoutes)
  })
  .prefix('/api')

router.get('/health', [HealthController, 'handle'])
