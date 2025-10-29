import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const MobileAirtimeController = () => import('#mobile/airtime/controllers/airtime_controller')

export default function mobileAirtimeRoutes() {
  return router
    .group(() => {
      // New Mobile Airtime feature endpoints
      router.get('/options/:serviceType', [MobileAirtimeController, 'getOptions'])
      router.get('/options/:serviceType/to/:fromProviderCode', [
        MobileAirtimeController,
        'getToOptions',
      ])
      router.post('/quote', [MobileAirtimeController, 'quote'])
      router.post('/purchase', [MobileAirtimeController, 'purchase'])

      // Legacy-wrapped endpoints
      router.post('/', [MobileAirtimeController, 'airtime'])
      router.get('/country', [MobileAirtimeController, 'country'])
      router.get('/country/:code/operators', [MobileAirtimeController, 'countryOperator'])
    })
    .use(middleware.auth())
    .prefix('mobile/airtime')
}
