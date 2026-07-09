import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { otpThrottle } from '#core/identity/otp/presentation/throttles/otp_throttle'

const BusinessAuthController = () =>
  import('#aiglebusiness/auth/presentation/client/controllers/business_auth_controller')
const BusinessSessionController = () =>
  import('#aiglebusiness/auth/presentation/client/controllers/business_session_controller')

export default function businessAuthRoutes() {
  router
    .group(() => {
      router
        .post('auth/check-phone', [BusinessAuthController, 'checkPhone'])
        .use([middleware.geoip(), middleware.businessChannel()])
      router
        .post('auth/login', [BusinessAuthController, 'login'])
        .use([middleware.geoip(), middleware.businessChannel(), otpThrottle])
      router
        .post('auth/verify', [BusinessAuthController, 'verify'])
        .use([middleware.geoip(), middleware.businessDevice()])

      router
        .group(() => {
          router.get('auth/sessions', [BusinessSessionController, 'index'])
          router.delete('auth/sessions/:id', [BusinessSessionController, 'destroy'])
        })
        .use([middleware.auth(), middleware.requireApp({ app: AppName.AIGLEBUSINESS })])
    })
    .prefix('business')
}
