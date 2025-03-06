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

router
  .group(() => {
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
        router.get('details-by-user/:transactionId/:transactionUid', [
          TransactionsController,
          'details_by_user',
        ])
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
