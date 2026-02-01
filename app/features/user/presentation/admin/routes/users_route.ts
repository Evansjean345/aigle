import router from '@adonisjs/core/services/router'

const UsersController = () =>
  import('#features/user/presentation/admin/controllers/users_controller')

const AdminTransactionController = () =>
  import('#features/transactions/presentation/admin/controllers/transactions_controller')

const LedgersController = () =>
  import('#features/ledger/presentation/admin/controllers/ledgers_controller')

const KycController = () =>
  import('#features/kyc/presentation/admin/controllers/kyc_controller')

export default function adminUsersRoute() {
  return router
    .group(() => {
      router.group(() => {
        router.get('/', [UsersController, 'index'])
        router.get('/stats', [UsersController, 'stats'])
        router.get('/:id', [UsersController, 'show'])
        router.get('/:id/wallet-stats', [UsersController, 'walletStats'])
        router.get('/:id/transactions', [AdminTransactionController, 'getUserTransactions'])
        router.get('/:id/transactions/stats', [
          AdminTransactionController,
          'getUserTransactionStats',
        ])
        router.get('/:id/ledgers', [LedgersController, 'getUserLedgers'])
        router.get('/:id/ledgers/stats', [LedgersController, 'getUserLedgerStats'])
        router.get('/:id/ledgers/chart', [LedgersController, 'getUserLedgerChart'])
        router.get('/:id/kyc', [KycController, 'getUserKyc'])
        router.put('/:id/block', [UsersController, 'block'])
        router.put('/:id/activate', [UsersController, 'activate'])
      })
    })
    .prefix('users')
}
