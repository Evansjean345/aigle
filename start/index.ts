import { HttpRouterService } from '@adonisjs/core/types'

const OperationController = () => import('#controllers/api/operations_controller')
const WebhooksController = () => import('#controllers/api/webhooks_controller')
const AuthController = () => import('#controllers/api/auths_controller')

export const operationRouter = (router: HttpRouterService) => {
  return () => {
    router.post('virement', [OperationController, 'demande_virement'])
    router.get('virement/all', [OperationController, 'liste_virement'])
    router.post('depot', [OperationController, 'depot'])
    router.post('transfert', [OperationController, 'transfert'])
    router.post('transfert-inter', [OperationController, 'transfert_inter'])
    router.get('data/forfait/:country_code/:operator', [OperationController, 'data_forfait'])
    router.post('airtime', [OperationController, 'airtime'])
    router.get('airtime/country', [OperationController, 'airtime_country'])
    router.get('airtime/country/operator/:code', [OperationController, 'airtime_country_operator'])
  }
}

export const webHookRouter = (router) => {
  return () => {
    router.post('/deposit/failure', [WebhooksController, 'web_hook_deposit_failure'])
    router.post('/deposit/success', [WebhooksController, 'web_hook_deposit_success'])

    router.post('/transfer/failure', [WebhooksController, 'web_hook_transfer_failure'])
    router.post('/transfer/success', [WebhooksController, 'web_hook_transfer_success'])

    router.post('/transfer-inter/failure', [WebhooksController, 'web_hook_transfert_inter_failure'])

    router.post('/transfer-inter/success', [WebhooksController, 'web_hook_transfert_inter_success'])

    router.post('/transfer-inter/second-step/failure', [
      WebhooksController,
      'web_hook_transfert_inter_second_failure',
    ])

    router.post('/transfer-inter/second-step/success', [
      WebhooksController,
      'web_hook_transfert_inter_second_success',
    ])

    // route webhook de achat de airtime
    router.post('/airtime/first-step/success', [
      WebhooksController,
      'web_hook_first_step_airtime_success',
    ])

    router.post('/airtime/first-step/failure', [
      WebhooksController,
      'web_hook_first_step_airtime_failure',
    ])
  }
}

export const authRouter = (router: HttpRouterService, middleware) => {
  return () => {
    router.post('register', [AuthController, 'register'])
    router.post('login', [AuthController, 'login'])
    router.get('me', [AuthController, 'user_auth']).use(middleware.auth({ guards: ['api'] }))
    router.get('logout', [AuthController, 'logout']).use(middleware.auth({ guards: ['api'] }))
    router.post('check-phone', [AuthController, 'check_phone'])
    router.post('access-token', [AuthController, 'access_token'])
    router.post('check-pin-code', [AuthController, 'check_pin_code'])
    router.post('password-reset', [AuthController, 'reset_password'])
  }
}
