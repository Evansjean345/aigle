import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import {
  ORGANISATION_PERMISSIONS,
  ORGANISATION_MEMBER_PERMISSIONS,
  ORGANISATION_ROLE_PERMISSIONS,
  ORGANISATION_WALLET_PERMISSIONS,
} from '#aiglebusiness/organisation/presentation/admin/permissions.config'

const AdminOrganisationsController = () =>
  import('#aiglebusiness/organisation/presentation/admin/controllers/admin_organisations_controller')

/**
 * Consultation des organisations par l'espace admin.
 */
const adminOrganisationRoutes = () => {
  router
    .group(() => {
      router
        .get('/', [AdminOrganisationsController, 'index'])
        .use(middleware.permission([ORGANISATION_PERMISSIONS.list]))

      router
        .get('/search', [AdminOrganisationsController, 'search'])
        .use(middleware.permission([ORGANISATION_PERMISSIONS.list]))

      router
        .get('/stats', [AdminOrganisationsController, 'stats'])
        .use(middleware.permission([ORGANISATION_PERMISSIONS.list]))

      router
        .get('/stuck-provisioning', [AdminOrganisationsController, 'stuckProvisioning'])
        .use(middleware.permission([ORGANISATION_PERMISSIONS.provisioningReview]))

      router
        .get('/:id', [AdminOrganisationsController, 'show'])
        .use(middleware.permission([ORGANISATION_PERMISSIONS.read]))

      router
        .get('/:id/members', [AdminOrganisationsController, 'members'])
        .use(middleware.permission([ORGANISATION_MEMBER_PERMISSIONS.list]))

      router
        .get('/:id/roles', [AdminOrganisationsController, 'roles'])
        .use(middleware.permission([ORGANISATION_ROLE_PERMISSIONS.list]))

      router
        .get('/:id/wallet-stats', [AdminOrganisationsController, 'walletStats'])
        .use(middleware.permission([ORGANISATION_WALLET_PERMISSIONS.read]))

      router
        .patch('/:id/payable', [AdminOrganisationsController, 'setPayable'])
        .use(middleware.permission([ORGANISATION_PERMISSIONS.payable]))

      router
        .patch('/:id/status', [AdminOrganisationsController, 'changeStatus'])
        .use(middleware.permission([ORGANISATION_PERMISSIONS.block]))

      router
        .post('/:id/resume-provisioning', [AdminOrganisationsController, 'resumeProvisioningNow'])
        .use(middleware.permission([ORGANISATION_PERMISSIONS.provisioningReview]))

      router
        .patch('/:id/wallet/freeze', [AdminOrganisationsController, 'freezeWallet'])
        .use(middleware.permission([ORGANISATION_WALLET_PERMISSIONS.freeze]))

      router
        .patch('/:id/wallet/unfreeze', [AdminOrganisationsController, 'unfreezeWallet'])
        .use(middleware.permission([ORGANISATION_WALLET_PERMISSIONS.unfreeze]))
    })
    .prefix('/organisations')
    .use(middleware.auth({ guards: ['admin'] }))
}

export default adminOrganisationRoutes
