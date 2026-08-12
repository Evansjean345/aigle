import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { ORGANISATION_KYB_PERMISSIONS } from '#aiglebusiness/organisation/presentation/admin/permissions.config'

const KybAdminController = () =>
  import('#aiglebusiness/kyb/presentation/admin/controllers/kyb_admin_controller')

/**
 * Revue des dossiers de vérification d'entreprise par l'espace admin.
 *
 * Approuver et refuser sont deux droits distincts : un gestionnaire peut être habilité à rejeter un
 * dossier incomplet sans pouvoir lever les plafonds d'une entreprise.
 */
const adminKybRoutes = () => {
  router
    .group(() => {
      router
        .get('/', [KybAdminController, 'index'])
        .use(middleware.permission([ORGANISATION_KYB_PERMISSIONS.read]))

      // Avant `/:id`, sinon « stats » serait pris pour un identifiant de dossier.
      router
        .get('/stats', [KybAdminController, 'stats'])
        .use(middleware.permission([ORGANISATION_KYB_PERMISSIONS.read]))

      router
        .get('/:id', [KybAdminController, 'show'])
        .use(middleware.permission([ORGANISATION_KYB_PERMISSIONS.read]))

      router
        .post('/:id/approve', [KybAdminController, 'approve'])
        .as('kyb_admin.approve')
        .use(middleware.permission([ORGANISATION_KYB_PERMISSIONS.approve]))

      router
        .post('/:id/reject', [KybAdminController, 'reject'])
        .as('kyb_admin.reject')
        .use(middleware.permission([ORGANISATION_KYB_PERMISSIONS.reject]))
    })
    .prefix('/kyb')
    .use(middleware.auth({ guards: ['admin'] }))
}

export default adminKybRoutes
