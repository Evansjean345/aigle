import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import { BUSINESS_PERMISSION } from '#aiglebusiness/membership/domain/permissions.config'
import {
  massTransferSimulateThrottle,
  massTransferInitiateThrottle,
} from '#aiglebusiness/transfer/mass/presentation/client/throttles/mass_transfer_throttles'

const MassTransferController = () =>
  import('#aiglebusiness/transfer/mass/presentation/client/controllers/mass_transfer_controller')

/** Middlewares communs du canal client business (avant l'`orgPermission` spécifique). */
const businessChannel = () => [
  middleware.geoip(),
  middleware.businessChannel(),
  middleware.auth(),
  middleware.requireApp({ app: AppName.AIGLEBUSINESS }),
  middleware.businessDevice(),
]

/**
 * Paiement en masse d'une organisation (canal client), scopé `organisations/:organisationId`.
 * **Gate ENTERPRISE** (L2-D23) sur **tous** les groupes (`requireEnterpriseForMass`, après
 * `orgPermission` pour ne pas révéler le type d'org à un non-membre). Permissions par usage :
 * initiation `transfer:initiate` · maker-checker `transfer:approve` · lecture `transactions:view`.
 */
export default function massTransferRoutes() {
  // Simulation — transfer:initiate (devis avant engagement, lecture pure)
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
      middleware.requireEnterpriseForMass(),
    ])

  // Initiation — transfer:initiate
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
      middleware.requireEnterpriseForMass(),
    ])

  // Maker-checker — transfer:approve
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
      middleware.requireEnterpriseForMass(),
    ])

  // Lecture — transactions:view
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
      middleware.requireEnterpriseForMass(),
    ])
}
