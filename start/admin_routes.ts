import router from '@adonisjs/core/services/router'
import adminServicesManagementRoutes from '#core/catalog/catalogs/presentation/admin/routes/services_management_routes'
import adminTransactionRoutes from '#core/money/transactions/presentation/admin/routes/transaction_routes'
import adminUsersRoute from '#core/identity/user/presentation/admin/routes/users_route'
import adminLedgerRoutes from '#core/money/ledger/presentation/admin/routes/ledger_routes'
import adminCollectionAccountRoutes from '#aiglebusiness/funding/presentation/admin/routes/collection_account_routes'
import adminFundingRequestRoutes from '#aiglebusiness/funding/presentation/admin/routes/funding_request_routes'
import adminMassTransferRoutes from '#aiglebusiness/transfer/mass/presentation/admin/routes/admin_mass_transfer_routes'
import adminOrganisationRoutes from '#aiglebusiness/organisation/presentation/admin/routes/admin_organisation_routes'
import adminKycRoutes from '#aiglesend/kyc/presentation/admin/routes/kyc_routes'
import adminAppVersionRoutes from '#core/identity/device/presentation/admin/routes/app_version_routes'
import adminDeviceRoutes from '#core/identity/device/presentation/admin/routes/admin_device_routes'
import adminWalletRoutes from '#aiglesend/wallet/presentation/admin/routes/admin_wallet_routes'
import adminAuthRoutes from '#core/team/authentication/presentation/routes/admin_auth_routes'
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
    router.group(adminCollectionAccountRoutes)
    router.group(adminFundingRequestRoutes)
    router.group(adminMassTransferRoutes)
    router.group(adminOrganisationRoutes)
    router.group(adminKycRoutes)
    router.group(adminDeviceRoutes)
    router.group(adminAppVersionRoutes)
    router.group(adminWalletRoutes)
    router.group(adminAuditRoutes)
  })
  .prefix('/api/admin')
