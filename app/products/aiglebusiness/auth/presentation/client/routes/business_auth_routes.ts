import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { otpThrottle } from '#core/identity/otp/presentation/throttles/otp_throttle'

const BusinessAuthController = () =>
  import('#aiglebusiness/auth/presentation/client/controllers/business_auth_controller')
const BusinessSessionController = () =>
  import('#aiglebusiness/auth/presentation/client/controllers/business_session_controller')

/**
 * Routes d'authentification business (canal client). `login`/`verify` sont
 * **publiques** (aucun token encore) ; les sessions sont **authentifiées** et
 * cloisonnées (`auth` + `requireApp('aiglebusiness')`).
 */
export default function businessAuthRoutes() {
  router
    .group(() => {
      // ── Public : check-phone → login (throttle OTP) → verify ──
      router.post('auth/check-phone', [BusinessAuthController, 'checkPhone'])
      router.post('auth/login', [BusinessAuthController, 'login']).use(otpThrottle)
      router.post('auth/verify', [BusinessAuthController, 'verify'])

      // ── Authentifié : mes sessions (Lot 3) ──
      router
        .group(() => {
          router.get('auth/sessions', [BusinessSessionController, 'index'])
          router.delete('auth/sessions/:id', [BusinessSessionController, 'destroy'])
        })
        .use([middleware.auth(), middleware.requireApp({ app: AppName.AIGLEBUSINESS })])
    })
    .prefix('business')
}
