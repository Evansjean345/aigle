import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { otpThrottle } from '#core/identity/otp/presentation/throttles/otp_throttle'

// Extraction des headers device (optionnelle : le portail web n'en envoie pas).
const optionalDevice = () => middleware.device({ required: false })

const BusinessAuthController = () =>
  import('#aiglebusiness/auth/presentation/client/controllers/business_auth_controller')
const BusinessSessionController = () =>
  import('#aiglebusiness/auth/presentation/client/controllers/business_session_controller')

export default function businessAuthRoutes() {
  router
    .group(() => {
      router.post('auth/check-phone', [BusinessAuthController, 'checkPhone'])
      router.post('auth/login', [BusinessAuthController, 'login']).use(otpThrottle)
      router.post('auth/verify', [BusinessAuthController, 'verify']).use(optionalDevice())

      router
        .group(() => {
          router.get('auth/sessions', [BusinessSessionController, 'index'])
          router.delete('auth/sessions/:id', [BusinessSessionController, 'destroy'])
        })
        .use([middleware.auth(), middleware.requireApp({ app: AppName.AIGLEBUSINESS })])
    })
    .prefix('business')
}
