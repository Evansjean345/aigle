import router from '@adonisjs/core/services/router'

const HealthController = () => import('#shared/infrastructure/controllers/health_controller')

import mobileAuthRoutes from '#core/identity/authentication/presentation/mobile/routes/auth_routes'
import mobileWalletRoutes from '#core/money/wallet/presentation/mobile/routes/wallet_routes'
import mobileServicesRoutes from '#core/catalog/catalogs/presentation/mobile/routes/services_routes'
import mobileOperationRoutes from '#aiglesend/operations/presentation/mobile/routes/operation_routes'
import providerWebhookRoutes from '#core/money/webhooks/presentation/provider/routes/provider_webhook_routes'
import mobileTransactionRoutes from '#core/money/transactions/presentation/mobile/routes/transaction_routes'
import userAccountMobileRoutes from '#core/identity/user/presentation/mobile/routes/profile_routes'
import mobileQrRoutes from '#aiglesend/qr/presentation/mobile/routes/qr_routes'
import mobileKycRoutes from '#core/identity/kyc/presentation/mobile/routes/kyc_routes'
import mobileDeviceRoutes from '#core/identity/device/presentation/mobile/routes/device_routes'
import mobileDebitPhoneRoutes from '#core/identity/user/presentation/mobile/routes/debit_phone_routes'
import businessAuthRoutes from '#aiglebusiness/auth/presentation/client/routes/business_auth_routes'
import businessClientRoutes from '#aiglebusiness/organisation/presentation/client/routes/business_routes'
import membershipClientRoutes from '#aiglebusiness/membership/presentation/client/routes/membership_routes'
import businessTransactionsRoutes from '#aiglebusiness/transactions/presentation/client/routes/business_transactions_routes'
import businessTransferRoutes from '#aiglebusiness/transfer/presentation/client/routes/business_transfer_routes'
import businessDeviceRoutes from '#aiglebusiness/device/presentation/client/routes/business_device_routes'
import businessCatalogRoutes from '#aiglebusiness/catalog/presentation/client/routes/business_catalog_routes'
import payableAliasRoutes from '#core/qr/presentation/public/routes/payable_alias_routes'
import checkoutRoutes from '#core/money/checkout/presentation/public/routes/checkout_routes'

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
    router.group(businessAuthRoutes)
    router.group(businessClientRoutes)
    router.group(membershipClientRoutes)
    router.group(businessTransactionsRoutes)
    router.group(businessTransferRoutes)
    router.group(businessDeviceRoutes)
    router.group(businessCatalogRoutes)
    router.group(payableAliasRoutes)
    router.group(checkoutRoutes)
  })
  .prefix('/api')

router.get('/health', [HealthController, 'handle'])
