import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'

const ClientCollectionAccountsController = () =>
  import('#aiglebusiness/funding/presentation/client/controllers/collection_accounts_controller')

/**
 * Catalogue consulté par le marchand (F1) : les comptes sur lesquels verser pour réapprovisionner.
 *
 * Gardé par `provision:request` — la permission de **demander un approvisionnement** : celui qui
 * peut faire la demande est exactement celui qui a besoin de savoir où verser. Pas de permission de
 * lecture séparée, qui n'apporterait rien et multiplierait les rôles à administrer.
 *
 * Lecture seule : le marchand ne peut ni créer ni modifier un canal.
 */
const clientCollectionAccountRoutes = () => {
  router
    .group(() => {
      router.get('organisations/:organisationId/collection-accounts', [
        ClientCollectionAccountsController,
        'index',
      ])
    })
    .prefix('business')
    .use([
      middleware.geoip(),
      middleware.businessChannel(),
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
      middleware.businessDevice(),
      middleware.orgPermission({ permission: BUSINESS_PERMISSION.provisionRequest }),
    ])
}

export default clientCollectionAccountRoutes
