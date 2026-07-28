import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const CollectionAccountsController = () =>
  import('#aiglebusiness/funding/presentation/admin/controllers/collection_accounts_controller')

/**
 * Administration du catalogue des comptes de collecte (F1) — back-office Aigle.
 *
 * ⚠️ **Aucune route DELETE** : un canal se désactive (`PATCH .../toggle`), il ne se supprime pas —
 * les demandes de réapprovisionnement le référencent (R-D6).
 * ⚠️ **Aucune route ne modifie l'identifiant bancaire** : le changer détournerait les versements
 * suivants. Changer de compte = désactiver l'ancien + en créer un nouveau.
 */
const adminCollectionAccountRoutes = () => {
  router
    .group(() => {
      router.get('/', [CollectionAccountsController, 'index'])
      router.post('/', [CollectionAccountsController, 'store'])
      router.patch('/:reference', [CollectionAccountsController, 'update'])
      router.patch('/:reference/toggle', [CollectionAccountsController, 'toggle'])
    })
    .prefix('/collection-accounts')
    .use(middleware.auth({ guards: ['admin'] }))
}

export default adminCollectionAccountRoutes
