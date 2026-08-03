import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { MASS_TRANSFER_PERMISSIONS } from '#aiglebusiness/transfer/mass/presentation/admin/permissions.config'

const AdminMassTransfersController = () =>
  import('#aiglebusiness/transfer/mass/presentation/admin/controllers/admin_mass_transfers_controller')

/**
 * Consultation des lots de paiement en masse depuis l'espace admin.
 *
 * **Lecture seule** : aucune route n'approuve, ne rejette ni ne relance un lot. L'approbation est un
 * contrôle interne à l'organisation, entre deux de ses membres — s'y substituer le rendrait
 * contournable en appelant le support.
 */
const adminMassTransferRoutes = () => {
  router
    .group(() => {
      router.get('/', [AdminMassTransfersController, 'index'])
      router.get('/:reference', [AdminMassTransfersController, 'show'])
    })
    .prefix('/mass-transfers')
    .use([
      middleware.auth({ guards: ['admin'] }),
      middleware.permission([MASS_TRANSFER_PERMISSIONS.read]),
    ])
}

export default adminMassTransferRoutes
