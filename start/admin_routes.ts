import router from '@adonisjs/core/services/router'
import adminServicesManagementRoutes from '#features/catalogs/presentation/admin/routes/services_management_routes'
import adminTransactionRoutes from '#features/transactions/presentation/admin/routes/transaction_routes'
import adminUsersRoute from '#features/user/presentation/admin/routes/users_route'

router
  .group(() => {
    router.group(adminServicesManagementRoutes)
    router.group(adminTransactionRoutes)
    router.group(adminUsersRoute)
  })
  .prefix('/administration/api')
