import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { COLLECTION_ACCOUNT_PERMISSIONS } from '#aiglebusiness/funding/presentation/admin/permissions.config'

const CollectionAccountsController = () =>
  import('#aiglebusiness/funding/presentation/admin/controllers/collection_accounts_controller')

/**
 * Administration du catalogue des comptes de collecte.
 *
 * Pas de route de suppression : un compte se désactive. Aucune route ne modifie l'identifiant
 * bancaire. La lecture et l'écriture sont gardées par deux permissions distinctes.
 */
const adminCollectionAccountRoutes = () => {
  router
    .group(() => {
      router
        .get('/', [CollectionAccountsController, 'index'])
        .use(middleware.permission([COLLECTION_ACCOUNT_PERMISSIONS.list]))

      router
        .post('/', [CollectionAccountsController, 'store'])
        .use(middleware.permission([COLLECTION_ACCOUNT_PERMISSIONS.manage]))

      router
        .patch('/:reference', [CollectionAccountsController, 'update'])
        .use(middleware.permission([COLLECTION_ACCOUNT_PERMISSIONS.manage]))

      router
        .patch('/:reference/toggle', [CollectionAccountsController, 'toggle'])
        .use(middleware.permission([COLLECTION_ACCOUNT_PERMISSIONS.manage]))
    })
    .prefix('/collection-accounts')
    .use(middleware.auth({ guards: ['admin'] }))
}

export default adminCollectionAccountRoutes
