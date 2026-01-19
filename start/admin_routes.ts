import router from '@adonisjs/core/services/router'
import adminServicesManagementRoutes from '#features/catalogs/presentation/admin/routes/services_management_routes'
import adminTransactionRoutes from '#features/transactions/presentation/admin/routes/transaction_routes'
import adminUsersRoute from '#features/user/presentation/admin/routes/users_route'
import adminLedgerRoutes from '#features/ledger/presentation/admin/routes/ledger_routes'
import adminKycRoutes from '#features/kyc/presentation/admin/routes/kyc_routes'

router
  .group(() => {
    router.group(adminServicesManagementRoutes)
    router.group(adminTransactionRoutes)
    router.group(adminUsersRoute)
    router.group(adminLedgerRoutes)
    router.group(adminKycRoutes)
  })
  .prefix('/api/admin')
