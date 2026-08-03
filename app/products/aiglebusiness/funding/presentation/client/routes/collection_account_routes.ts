import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'
import FundingEnterpriseOnlyException from '#aiglebusiness/funding/domain/exceptions/funding_enterprise_only_exception'

const ClientCollectionAccountsController = () =>
  import('#aiglebusiness/funding/presentation/client/controllers/collection_accounts_controller')

/**
 * Catalogue consulté par le marchand pour savoir où verser.
 *
 * Lecture seule, gardée par `provision:request` et réservée aux organisations de type entreprise,
 * comme la déclaration elle-même.
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
      middleware.activeOrganisation(),
      middleware.orgPermission({ permission: BUSINESS_PERMISSION.provisionRequest }),
      middleware.requireEnterprise({ onDenied: () => new FundingEnterpriseOnlyException() }),
    ])
}

export default clientCollectionAccountRoutes
