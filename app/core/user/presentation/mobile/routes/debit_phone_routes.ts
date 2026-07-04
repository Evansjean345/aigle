import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { otpThrottle } from '#start/limiter'

const DebitPhoneController = () =>
  import('#core/user/presentation/mobile/controllers/debit_phone_controller')

export default function mobileDebitPhoneRoutes() {
  return router
    .group(() => {
      router
        .group(() => {
          router.get('/', [DebitPhoneController, 'index'])
          router.post('/', [DebitPhoneController, 'store'])
          router.post('/verify', [DebitPhoneController, 'verify'])
          router.post('/resend-otp', [DebitPhoneController, 'resend']).use(otpThrottle)
        })
        .use([middleware.auth(), middleware.device()])
    })
    .prefix('mobile/debit-phones')
}
