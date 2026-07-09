import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

const BusinessHealthController = () =>
  import('#aiglebusiness/organisation/presentation/client/controllers/business_health_controller')
const OrganisationController = () =>
  import('#aiglebusiness/organisation/presentation/client/controllers/organisation_controller')

export default function businessClientRoutes() {
  router
    .group(() => {
      // Liveness : volontairement « nue » (sondes de monitoring sans en-tête de canal).
      router.get('health', [BusinessHealthController, 'handle'])

      router
        .group(() => {
          router.post('organisations', [OrganisationController, 'store'])
          router.get('organisations', [OrganisationController, 'index'])
        })
        .use([
          middleware.geoip(),
          middleware.businessChannel(),
          middleware.auth(),
          middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
          middleware.businessDevice(),
        ])
    })
    .prefix('business')
}
