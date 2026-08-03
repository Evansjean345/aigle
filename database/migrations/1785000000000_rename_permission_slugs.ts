import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Aligne les slugs de permissions sur la convention `[<contexte>.]<ressource>.<action>`.
 *
 * L'ordre des couples est significatif : un renommage qui libère un nom précède celui qui l'occupe.
 * Sans cela, `user.read` → `users.read` échouerait tant que `users.read` (devenu `users.list`)
 * existe encore.
 *
 * Les affectations aux rôles ne sont pas touchées : `role_permission` référence un identifiant, pas
 * un slug. Les permissions restées en base et absentes du catalogue sont ignorées.
 */
const RENAMES: Array<[string, string]> = [
  ['audit.read', 'audit_logs.list'],
  ['services.read', 'service_types.list'],
  ['service.read', 'service_types.read'],
  ['service.create', 'service_types.create'],
  ['service.update', 'service_types.update'],
  ['service.delete', 'service_types.delete'],
  ['payment_methods.read', 'payment_methods.list'],
  ['payment_method.read', 'payment_methods.read'],
  ['payment_method.create', 'payment_methods.create'],
  ['payment_method.update', 'payment_methods.update'],
  ['payment_method.delete', 'payment_methods.delete'],
  ['providers.read', 'providers.list'],
  ['provider.read', 'providers.read'],
  ['provider.create', 'providers.create'],
  ['provider.update', 'providers.update'],
  ['provider.activate', 'providers.activate'],
  ['provider.deactivate', 'providers.deactivate'],
  ['provider.delete', 'providers.delete'],
  ['tarifications.read', 'pricings.list'],
  ['tarification.read', 'pricings.read'],
  ['tarifications.create', 'pricings.create'],
  ['tarifications.update', 'pricings.update'],
  ['tarifications.delete', 'pricings.delete'],
  ['company_contacts.read', 'company_contacts.list'],
  ['company_contact.update', 'company_contacts.update'],
  ['user_devices.read', 'devices.list'],
  ['user_device.read', 'devices.read'],
  ['user_device.revoke', 'devices.revoke'],
  ['app_versions.read', 'app_versions.list'],
  ['app_version.read', 'app_versions.read'],
  ['app_version.create', 'app_versions.create'],
  ['app_version.update', 'app_versions.update'],
  ['app_version.delete', 'app_versions.delete'],
  ['kyc.read', 'kyc_documents.read'],
  ['kyc.approve', 'kyc_documents.approve'],
  ['kyc.reject', 'kyc_documents.reject'],
  ['kyc_levels.read', 'kyc_levels.list'],
  ['users.read', 'users.list'],
  ['users_report.read', 'users.export'],
  ['user.read', 'users.read'],
  ['user.block', 'users.block'],
  ['user.activate', 'users.activate'],
  ['ledgers.read', 'ledgers.list'],
  ['ledgers_report.read', 'ledgers.export'],
  ['user_ledgers.read', 'users.ledgers.list'],
  ['user_ledgers_report.read', 'users.ledgers.export'],
  ['transactions.read', 'transactions.list'],
  ['transactions_report.read', 'transactions.export'],
  ['transaction_ledger.read', 'transactions.ledgers.read'],
  ['transaction.read', 'transactions.read'],
  ['user_transactions.read', 'users.transactions.list'],
  ['user_transactions_report.read', 'users.transactions.export'],
  ['transaction_refund.execute', 'refunds.execute'],
  ['transactions_refunds.read', 'refunds.list'],
  ['user_wallet.read', 'users.wallets.read'],
  ['user_wallet.block', 'users.wallets.block'],
  ['user_wallet.activate', 'users.wallets.activate'],
  ['wallet_adjustment.execute', 'wallet_adjustments.execute'],
  ['wallet_adjustment.read', 'wallet_adjustments.list'],
  ['team.manage', 'admins.manage'],
  ['funding_requests.read', 'funding_requests.list'],
  ['funding_settings.manage', 'funding_settings.update'],
  ['collection_accounts.read', 'collection_accounts.list'],
  ['organisations.read', 'organisations.list'],
  ['organisation.read', 'organisations.read'],
  ['organisations.manage', 'organisations.payable'],
  ['organisation_members.read', 'organisations.members.list'],
  ['organisation_roles.read', 'organisations.roles.list'],
  ['organisation_wallet.read', 'organisations.wallets.read'],
  ['mass_transfers.read', 'mass_transfers.list'],
]

export default class extends BaseSchema {
  async up() {
    for (const [from, to] of RENAMES) {
      await this.db.from('permissions').where('slug', from).update({ slug: to })
    }
  }

  async down() {
    for (const [from, to] of [...RENAMES].reverse()) {
      await this.db.from('permissions').where('slug', to).update({ slug: from })
    }
  }
}
