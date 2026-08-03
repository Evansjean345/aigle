import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import {
  FUNDING_REQUEST_PERMISSIONS,
  FUNDING_SETTINGS_PERMISSIONS,
} from '#aiglebusiness/funding/presentation/admin/permissions.config'

const AdminFundingRequestsController = () =>
  import('#aiglebusiness/funding/presentation/admin/controllers/funding_requests_controller')
const AdminFundingSettingsController = () =>
  import('#aiglebusiness/funding/presentation/admin/controllers/funding_settings_controller')

/**
 * Revue des demandes de réapprovisionnement par le back-office.
 *
 * Trois permissions distinctes : `funding_requests.read` pour consulter la file et les justificatifs,
 * `funding_requests.review` pour valider, confirmer ou refuser, et `funding_settings.manage` pour
 * régler le seuil de double validation.
 *
 * `funding_requests.review` ne doit cohabiter ni avec `wallet_adjustment.execute` ni avec
 * `funding_settings.manage` dans un même rôle : qui règle le seuil règle le contrôle.
 *
 * Aucune route ne défait une décision : retirer de l'argent déjà crédité est un ajustement distinct.
 */
const adminFundingRequestRoutes = () => {
  router
    .group(() => {
      router
        .get('/', [AdminFundingRequestsController, 'index'])
        .use(middleware.permission([FUNDING_REQUEST_PERMISSIONS.list]))

      router
        .get('/:reference', [AdminFundingRequestsController, 'show'])
        .use(middleware.permission([FUNDING_REQUEST_PERMISSIONS.list]))

      router
        .post('/:reference/approve', [AdminFundingRequestsController, 'approve'])
        .use(middleware.permission([FUNDING_REQUEST_PERMISSIONS.review]))

      router
        .post('/:reference/confirm', [AdminFundingRequestsController, 'confirm'])
        .use(middleware.permission([FUNDING_REQUEST_PERMISSIONS.review]))

      router
        .post('/:reference/reject', [AdminFundingRequestsController, 'reject'])
        .use(middleware.permission([FUNDING_REQUEST_PERMISSIONS.review]))
    })
    .prefix('/funding-requests')
    .use(middleware.auth({ guards: ['admin'] }))

  router
    .group(() => {
      // Lecture ouverte aux gestionnaires : connaître le seuil ne l'affaiblit pas, c'est le
      // modifier qui désarme le contrôle. Sans cela, un valideur ne pourrait pas savoir si son
      // dossier exigera un second regard.
      router
        .get('/', [AdminFundingSettingsController, 'show'])
        .use(
          middleware.permission([
            FUNDING_REQUEST_PERMISSIONS.list,
            FUNDING_SETTINGS_PERMISSIONS.manage,
          ])
        )

      router
        .put('/', [AdminFundingSettingsController, 'update'])
        .use(middleware.permission([FUNDING_SETTINGS_PERMISSIONS.manage]))
    })
    .prefix('/funding-settings')
    .use(middleware.auth({ guards: ['admin'] }))
}

export default adminFundingRequestRoutes
