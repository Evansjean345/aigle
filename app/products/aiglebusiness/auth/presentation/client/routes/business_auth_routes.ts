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
      // check-phone + login : canal (traçage) + géo/IP. Pas de device : au login,
      // l'appareil passe par le CORPS et la règle est appliquée par le use case.
      router.post('auth/check-phone', [BusinessAuthController, 'checkPhone'])
      router.post('auth/login', [BusinessAuthController, 'login']).use(otpThrottle)

      // À partir du verify, l'appareil est requis (headers) selon le canal.
      router
        .post('auth/verify', [BusinessAuthController, 'verify'])
        .use(middleware.businessDevice())

      router
        .group(() => {
          router.get('auth/sessions', [BusinessSessionController, 'index'])
          router.delete('auth/sessions/:id', [BusinessSessionController, 'destroy'])
          // Déverrouillage / lock-screen : vérifie le PIN du user authentifié.
          router.post('auth/check-pin', [BusinessAuthController, 'checkPinCode'])
        })
        .use([
          middleware.auth(),
          middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
          middleware.businessDevice(),
        ])
    })
    .prefix('business')
    // Canal + géo/IP sur TOUTES les routes auth business (traçage + audit).
    .use([middleware.geoip(), middleware.businessChannel()])
}
