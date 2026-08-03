import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { USER_TRANSACTION_PERMISSIONS } from '#core/money/transactions/presentation/admin/permissions.config'
import { USER_LEDGER_PERMISSIONS } from '#core/money/ledger/presentation/admin/permissions.config'
import { KYC_PERMISSIONS } from '#core/identity/kyc/presentation/admin/permissions.config'
import { USER_PERMISSIONS } from '#core/identity/user/presentation/admin/permissions.config'
import { USER_WALLET_PERMISSIONS } from '#core/money/wallet/presentation/admin/permissions.config'

const UsersController = () =>
  import('#core/identity/user/presentation/admin/controllers/users_controller')

const AdminTransactionController = () =>
  import('#core/money/transactions/presentation/admin/controllers/transactions_controller')

const LedgersController = () =>
  import('#core/money/ledger/presentation/admin/controllers/ledgers_controller')

const KycController = () =>
  import('#core/identity/kyc/presentation/admin/controllers/kyc_controller')

export default function adminUsersRoute() {
  return router
    .group(() => {
      router.group(() => {
        router
          .get('/', [UsersController, 'index'])
          .use(middleware.permission([USER_PERMISSIONS.usersRead]))

        // Parcourir l'annuaire et retrouver une personne précise sont deux besoins distincts :
        // l'assistance cherche un client qui l'appelle, sans avoir à voir tous les autres.
        router
          .get('/search', [UsersController, 'search'])
          .use(middleware.permission([USER_PERMISSIONS.usersRead, USER_PERMISSIONS.search]))

        router
          .get('/stats', [UsersController, 'stats'])
          .use(middleware.permission([USER_PERMISSIONS.usersReportRead]))

        router
          .get('/:id', [UsersController, 'show'])
          .use(middleware.permission([USER_PERMISSIONS.userRead]))

        router
          .get('/:id/wallet-stats', [UsersController, 'walletStats'])
          .use(middleware.permission([USER_WALLET_PERMISSIONS.read]))
        router
          .get('/:id/transactions', [AdminTransactionController, 'getUserTransactions'])
          .use(middleware.permission([USER_TRANSACTION_PERMISSIONS.list]))

        router
          .get('/:id/transactions/stats', [AdminTransactionController, 'getUserTransactionStats'])
          .use(middleware.permission([USER_TRANSACTION_PERMISSIONS.export]))

        router
          .get('/:id/ledgers', [LedgersController, 'getUserLedgers'])
          .use(middleware.permission([USER_LEDGER_PERMISSIONS.list]))

        router
          .get('/:id/ledgers/stats', [LedgersController, 'getUserLedgerStats'])
          .use(middleware.permission([USER_LEDGER_PERMISSIONS.export]))

        router
          .get('/:id/kyc', [KycController, 'getUserKyc'])
          .use(middleware.permission([KYC_PERMISSIONS.read]))
        router
          .put('/:id/block', [UsersController, 'block'])
          .use(middleware.permission([USER_PERMISSIONS.userBlock]))

        router
          .put('/:id/activate', [UsersController, 'activate'])
          .use(middleware.permission([USER_PERMISSIONS.userActivate]))
      })
    })
    .prefix('users')
    .use(
      middleware.auth({
        guards: ['admin'],
      })
    )
}
