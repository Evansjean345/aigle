import router from '@adonisjs/core/services/router'
import adminServicesManagementRoutes from '#core/catalogs/presentation/admin/routes/services_management_routes'
import adminTransactionRoutes from '#core/transactions/presentation/admin/routes/transaction_routes'
import adminUsersRoute from '#core/user/presentation/admin/routes/users_route'
import adminLedgerRoutes from '#core/ledger/presentation/admin/routes/ledger_routes'
import adminKycRoutes from '#core/kyc/presentation/admin/routes/kyc_routes'
import adminAppVersionRoutes from '#core/device/presentation/admin/routes/app_version_routes'
import adminDeviceRoutes from '#core/device/presentation/admin/routes/admin_device_routes'
import adminWalletRoutes from '#core/wallet/presentation/admin/routes/admin_wallet_routes'
import adminAuthRoutes from '#core/authentication/presentation/admin/routes/admin_auth_routes'
import adminAuditRoutes from '#core/audit/presentation/admin/routes/admin_audit_routes'
import teamRoutes from '#core/team/presentation/routes/team_routes'

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
