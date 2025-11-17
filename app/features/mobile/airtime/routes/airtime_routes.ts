import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const MobileAirtimeController = () => import('#mobile/airtime/controllers/airtime_controller')

export default function mobileAirtimeRoutes() {
  return router
    .group(() => {
      // New Mobile Airtime feature endpoints
      router.post('/purchase', [MobileAirtimeController, 'purchase'])

      // Legacy-wrapped endpoints
      router.post('/', [MobileAirtimeController, 'airtime'])
      router.get('/countries', [MobileAirtimeController, 'countries'])
      router.get('/countries/:country_id/operators', [MobileAirtimeController, 'countryOperator'])
      router.get('/countries/:country_id/operators/:operator/bundles', [
        MobileAirtimeController,
        'operatorBundles',
      ])
    })
    .use(middleware.auth())
    .prefix('mobile/airtime')
}
