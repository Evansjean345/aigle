import router from '@adonisjs/core/services/router'
import { otpThrottle } from '#core/identity/otp/presentation/throttles/otp_throttle'

const BusinessAuthController = () =>
  import('#aiglebusiness/auth/presentation/client/controllers/business_auth_controller')

/**
 * Routes d'authentification business (canal client) — **publiques** (aucun token
 * encore). `login` déclenche un OTP → protégé par le throttle OTP core.
 */
export default function businessAuthRoutes() {
  router
    .group(() => {
      router.post('auth/login', [BusinessAuthController, 'login']).use(otpThrottle)
      router.post('auth/verify', [BusinessAuthController, 'verify'])
    })
    .prefix('business')
}
