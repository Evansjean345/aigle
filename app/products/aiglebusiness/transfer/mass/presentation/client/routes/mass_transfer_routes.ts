import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'
import MassTransferEnterpriseOnlyException from '#aiglebusiness/transfer/mass/domain/exceptions/mass_transfer_enterprise_only_exception'
import {
  massTransferSimulateThrottle,
  massTransferInitiateThrottle,
} from '#aiglebusiness/transfer/mass/presentation/client/throttles/mass_transfer_throttles'

const MassTransferController = () =>
  import('#aiglebusiness/transfer/mass/presentation/client/controllers/mass_transfer_controller')

/** Middlewares communs du canal client business, posés avant la permission d'organisation. */
const businessChannel = () => [
  middleware.geoip(),
  middleware.businessChannel(),
  middleware.auth(),
  middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
  middleware.businessDevice(),
  middleware.activeOrganisation(),
]

/**
 * Routes du paiement en masse d'une organisation.
 *
 * Toutes réservées aux organisations de type entreprise, le contrôle étant posé après celui de la
 * permission d'organisation pour ne pas révéler le type d'une organisation à un non-membre.
 *
 * Une permission par usage : `transfer:initiate` pour simuler et initier, `transfer:approve` pour
 * approuver ou rejeter, `transactions:view` pour consulter.
 */
export default function massTransferRoutes() {
  // Simulation : devis avant engagement, lecture pure.
  router
    .group(() => {
      router
        .post('organisations/:organisationId/mass-transfers/simulate', [
          MassTransferController,
          'simulate',
        ])
        .use(massTransferSimulateThrottle)
    })
    .prefix('business')
    .use([
      ...businessChannel(),
      middleware.orgPermission({ permission: BUSINESS_PERMISSION.transferInitiate }),
      middleware.requireEnterprise({ onDenied: () => new MassTransferEnterpriseOnlyException() }),
    ])

  // Initiation d'un lot.
  router
    .group(() => {
      router
        .post('organisations/:organisationId/mass-transfers', [MassTransferController, 'create'])
        .use(massTransferInitiateThrottle)
    })
    .prefix('business')
    .use([
      ...businessChannel(),
      middleware.orgPermission({ permission: BUSINESS_PERMISSION.transferInitiate }),
      middleware.requireEnterprise({ onDenied: () => new MassTransferEnterpriseOnlyException() }),
    ])

  // Approbation et rejet, par un membre distinct de l'initiateur.
  router
    .group(() => {
      router.post('organisations/:organisationId/mass-transfers/:reference/approve', [
        MassTransferController,
        'approve',
      ])
      router.post('organisations/:organisationId/mass-transfers/:reference/reject', [
        MassTransferController,
        'reject',
      ])
    })
    .prefix('business')
    .use([
      ...businessChannel(),
      middleware.orgPermission({ permission: BUSINESS_PERMISSION.transferApprove }),
      middleware.requireEnterprise({ onDenied: () => new MassTransferEnterpriseOnlyException() }),
    ])

  // Consultation.
  router
    .group(() => {
      router.get('organisations/:organisationId/mass-transfers', [MassTransferController, 'index'])
      router.get('organisations/:organisationId/mass-transfers/:reference', [
        MassTransferController,
        'show',
      ])
    })
    .prefix('business')
    .use([
      ...businessChannel(),
      middleware.orgPermission({ permission: BUSINESS_PERMISSION.transactionsView }),
      middleware.requireEnterprise({ onDenied: () => new MassTransferEnterpriseOnlyException() }),
    ])
}
