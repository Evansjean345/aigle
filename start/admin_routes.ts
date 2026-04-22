import router from '@adonisjs/core/services/router'
import adminServicesManagementRoutes from '#features/catalogs/presentation/admin/routes/services_management_routes'
import adminTransactionRoutes from '#features/transactions/presentation/admin/routes/transaction_routes'
import adminUsersRoute from '#features/user/presentation/admin/routes/users_route'
import adminLedgerRoutes from '#features/ledger/presentation/admin/routes/ledger_routes'
import adminKycRoutes from '#features/kyc/presentation/admin/routes/kyc_routes'
import adminAppVersionRoutes from '#features/device/presentation/admin/routes/app_version_routes'
import adminDeviceRoutes from '#features/device/presentation/admin/routes/admin_device_routes'
import adminWalletRoutes from '#features/wallet/presentation/admin/routes/admin_wallet_routes'
import adminAuthRoutes from '#features/authentication/presentation/admin/routes/admin_auth_routes'
import adminAuditRoutes from '#features/audit/presentation/admin/routes/admin_audit_routes'
import teamRoutes from '#features/team/presentation/routes/team_routes'

router
  .group(() => {
    router.group(adminAuthRoutes)
    router.group(teamRoutes)
    router.group(adminServicesManagementRoutes)
    router.group(adminTransactionRoutes)
    router.group(adminUsersRoute)
    router.group(adminLedgerRoutes)
    router.group(adminKycRoutes)
    router.group(adminDeviceRoutes)
    router.group(adminAppVersionRoutes)
    router.group(adminWalletRoutes)
    router.group(adminAuditRoutes)
  })
  .prefix('/api/admin')
