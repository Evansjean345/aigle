/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
const OtpsController = () => import('#controllers/api/otps_controller')
const TransactionsController = () => import('#controllers/api/transactions_controller')
const UsersController = () => import('#controllers/api/users_controller')
const VerifyIdentitiesController = () => import('#controllers/api/verify_identities_controller')
const SettingsController = () => import('#controllers/api/settings_controller')
import { middleware } from '#start/kernel'
import { authRouter, operationRouter, webHookRouter } from './index.js'

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
    router.group(authRouter(router, middleware)).prefix('auth')
    router
      .group(() => {
        router
          .group(() => {
            router.get('all', [TransactionsController, 'get_all'])
            router.get('status/:id/:uid', [TransactionsController, 'update_status'])
            router.get(':id/:uid', [TransactionsController, 'details'])
          })
          .prefix('transaction')
      })
      .prefix('admin')

    router
      .group(() => {
        router.get('send/:phone', [OtpsController, 'send_otp'])
        router.post('check', [OtpsController, 'check_otp'])
      })
      .prefix('otp')

    router
      .group(() => {
        router.get('analytic', [UsersController, 'analytic'])
        router.get('all', [UsersController, 'all_user'])
      })
      .use(middleware.auth({ guards: ['api'] }))
      .prefix('user')

    router
      .group(() => {
        router.get('all-by-user', [TransactionsController, 'all_by_user'])
        router.get('details-by-user/:reference', [TransactionsController, 'details_by_user'])
        router.get('stream/:reference', [TransactionsController, 'stream_transaction'])
      })
      .use(middleware.auth({ guards: ['api'] }))
      .prefix('transaction')

    router
      .group(operationRouter(router))
      .use(middleware.auth({ guards: ['api'] }))
      .prefix('services')

    router
      .group(() => {
        router.post('create', [VerifyIdentitiesController, 'create_or_update'])
      })
      .use(middleware.auth({ guards: ['api'] }))
      .prefix('identity')

    router
      .group(webHookRouter(router))
      // .use(middleware.auth({ guards: ['api'] }))
      .prefix('web_hook')

    router
      .group(() => {
        router.get('operators/all', [SettingsController, 'operator'])
        router.get('operators/create', [SettingsController, 'create_operator'])
        router.post('calculate-fee', [SettingsController, 'calculate_fee'])
        router.get('services/all', [SettingsController, 'service'])
        router.post('services/create', [SettingsController, 'create_service'])
      })
      .prefix('settings')
  })
  .prefix('/api')
