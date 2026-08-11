import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'
import VerificationNotApplicableException from '#core/identity/kyc/domain/exceptions/verification_not_applicable_exception'

const KybController = () =>
  import('#aiglebusiness/kyb/presentation/client/controllers/kyb_controller')

/**
 * Dossier de vérification de l'entreprise, côté propriétaire.
 *
 * Une pièce par requête : l'entreprise dépose ce qu'elle a, quand elle l'a, et la réponse dit ce
 * qui manque encore. Réservées aux organisations de type entreprise — un marchand ne passe aucune
 * vérification.
 */
const clientKybRoutes = () => {
  router
    .group(() => {
      router
        .post('organisations/:organisationId/kyb/pieces', [KybController, 'store'])
        .use(middleware.orgPermission({ permission: BUSINESS_PERMISSION.kybSubmit }))
      router
        .get('organisations/:organisationId/kyb', [KybController, 'show'])
        .use(middleware.orgPermission({ permission: BUSINESS_PERMISSION.kybView }))
    })
    .prefix('business')
    .use([
      middleware.geoip(),
      middleware.businessChannel(),
      middleware.auth(),
      middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
      middleware.businessDevice(),
      middleware.activeOrganisation(),
      middleware.requireEnterprise({ onDenied: () => new VerificationNotApplicableException() }),
    ])
}

export default clientKybRoutes
