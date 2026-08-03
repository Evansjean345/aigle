import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'
import FundingEnterpriseOnlyException from '#aiglebusiness/funding/domain/exceptions/funding_enterprise_only_exception'

const FundingRequestsController = () =>
  import('#aiglebusiness/funding/presentation/client/controllers/funding_requests_controller')

/**
 * Déclarations de versement du marchand.
 *
 * Aucun mouvement d'argent : le versement a déjà eu lieu hors plateforme, ces routes enregistrent sa
 * déclaration et son justificatif.
 *
 * Pas de route de modification ni de suppression : une demande s'annule. Gardées par
 * `provision:request` et réservées aux organisations de type entreprise.
 */
const clientFundingRequestRoutes = () => {
  router
    .group(() => {
      router.post('organisations/:organisationId/funding-requests', [
        FundingRequestsController,
        'store',
      ])
      router.get('organisations/:organisationId/funding-requests', [
        FundingRequestsController,
        'index',
      ])
      router.get('organisations/:organisationId/funding-requests/:reference', [
        FundingRequestsController,
        'show',
      ])
      router.post('organisations/:organisationId/funding-requests/:reference/cancel', [
        FundingRequestsController,
        'cancel',
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

export default clientFundingRequestRoutes
