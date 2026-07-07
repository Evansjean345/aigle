import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const BusinessHealthController = () =>
  import('#aiglebusiness/organisation/presentation/client/controllers/business_health_controller')
const OrganisationController = () =>
  import('#aiglebusiness/organisation/presentation/client/controllers/organisation_controller')

export default function businessClientRoutes() {
  router
    .group(() => {
      router.get('health', [BusinessHealthController, 'handle'])

      router
        .group(() => {
          router.post('organisations', [OrganisationController, 'store'])
          router.get('organisations', [OrganisationController, 'index'])
        })
        .use(middleware.auth())
    })
    .prefix('business')
}
