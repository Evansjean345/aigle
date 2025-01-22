/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
const AuthController = () => import('#controllers/api/auths_controller')
const OtpsController = () => import('#controllers/api/otps_controller')
const TransactionsController = () => import('#controllers/api/transactions_controller')
const OperationController = () => import('#controllers/api/operations_controller')
const UsersController = () => import('#controllers/api/users_controller')
const WebhooksController = () => import('#controllers/api/webhooks_controller')
const VerifyIdentitiesController = () => import('#controllers/api/verify_identities_controller')
import { middleware } from '#start/kernel'

router
  .group(() => {
    router
      .group(() => {
        router.post('register', [AuthController, 'register'])
        router.post('login', [AuthController, 'login'])
        router.get('me', [AuthController, 'user_auth']).use(middleware.auth({ guards: ['api'] }))
        router.get('logout', [AuthController, 'logout']).use(middleware.auth({ guards: ['api'] }))
        router.post('check-phone', [AuthController, 'check_phone'])
        router.post('access-token', [AuthController, 'access_token'])
        router.post('check-pin-code', [AuthController, 'check_pin_code'])
        router.post('password-reset', [AuthController, 'reset_password'])
      })
      .prefix('auth')

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
        //Dépôt via Aigle.
        // router.get('depot', [TransactionsController, 'depot'])
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
      .group(() => {
        router.post('depot', [OperationController, 'depot'])
        router.post('transfert', [OperationController, 'transfert'])
        router.post('transfert-inter', [OperationController, 'transfert_inter'])
      })
      .use(middleware.auth({ guards: ['api'] }))
      .prefix('operation')

    router
      .group(() => {
        router.post('create', [VerifyIdentitiesController, 'create_or_update'])
      })
      .use(middleware.auth({ guards: ['api'] }))
      .prefix('identity')

    router
      .group(() => {
        router.post('/deposit/failure', [WebhooksController, 'web_hook_deposit_failure'])
        router.post('/deposit/success', [WebhooksController, 'web_hook_deposit_success'])

        router.post('/transfer/failure', [WebhooksController, 'web_hook_transfer_failure'])
        router.post('/transfer/success', [WebhooksController, 'web_hook_transfer_success'])

        router.post('/transfer-inter/failure', [
          WebhooksController,
          'web_hook_transfert_inter_failure',
        ])

        router.post('/transfer-inter/success', [
          WebhooksController,
          'web_hook_transfert_inter_success',
        ])
      })
      // .use(middleware.auth({ guards: ['api'] }))
      .prefix('web_hook')
  })
  .prefix('/api')
