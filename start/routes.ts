import router from '@adonisjs/core/services/router'

const HealthController = () => import('#shared/infrastructure/controllers/health_controller')

import mobileAuthRoutes from '#core/authentication/presentation/mobile/routes/auth_routes'
import mobileWalletRoutes from '#core/money/wallet/presentation/mobile/routes/wallet_routes'
import mobileServicesRoutes from '#core/catalogs/presentation/mobile/routes/services_routes'
import mobileOperationRoutes from '#aiglesend/operations/presentation/mobile/routes/operation_routes'
import providerWebhookRoutes from '#core/money/webhooks/presentation/provider/routes/provider_webhook_routes'
import mobileTransactionRoutes from '#core/money/transactions/presentation/mobile/routes/transaction_routes'
import userAccountMobileRoutes from '#core/user/presentation/mobile/routes/profile_routes'
import mobileQrRoutes from '#aiglesend/qr/presentation/mobile/routes/qr_routes'
import mobileKycRoutes from '#core/kyc/presentation/mobile/routes/kyc_routes'
import mobileDeviceRoutes from '#core/device/presentation/mobile/routes/device_routes'
import mobileDebitPhoneRoutes from '#core/user/presentation/mobile/routes/debit_phone_routes'

router
  .group(() => {
    router.group(mobileAuthRoutes)
    router.group(mobileWalletRoutes)
    router.group(mobileServicesRoutes)
    router.group(mobileOperationRoutes)
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
