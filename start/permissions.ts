import { collectPermissions } from '#core/team/domain/value_objects/permission_catalog'

import { AUDIT_PERMISSIONS } from '#core/audit/presentation/admin/permissions.config'
import {
  SERVICE_TYPE_PERMISSIONS,
  PAYMENT_METHOD_PERMISSIONS,
  PROVIDER_PERMISSIONS,
  PRICING_PERMISSIONS,
  COMPANY_CONTACT_PERMISSIONS,
} from '#core/catalog/catalogs/presentation/admin/permissions.config'
import {
  KYC_PERMISSIONS,
  KYC_LEVEL_PERMISSIONS,
} from '#core/identity/kyc/presentation/admin/permissions.config'
import { USER_PERMISSIONS } from '#core/identity/user/presentation/admin/permissions.config'
import {
  DEVICE_PERMISSIONS,
  APP_VERSION_PERMISSIONS,
} from '#core/identity/device/presentation/admin/permissions.config'
import {
  LEDGER_PERMISSIONS,
  USER_LEDGER_PERMISSIONS,
} from '#core/money/ledger/presentation/admin/permissions.config'
import {
  TRANSACTION_PERMISSIONS,
  USER_TRANSACTION_PERMISSIONS,
  REFUND_PERMISSIONS,
} from '#core/money/transactions/presentation/admin/permissions.config'
import {
  USER_WALLET_PERMISSIONS,
  WALLET_ADJUSTMENT_PERMISSIONS,
} from '#core/money/wallet/presentation/admin/permissions.config'
import { ADMIN_PERMISSIONS, ROLE_PERMISSIONS } from '#core/team/presentation/permissions.config'
import {
  FUNDING_REQUEST_PERMISSIONS,
  FUNDING_SETTINGS_PERMISSIONS,
  COLLECTION_ACCOUNT_PERMISSIONS,
} from '#aiglebusiness/funding/presentation/admin/permissions.config'
import {
  ORGANISATION_PERMISSIONS,
  ORGANISATION_MEMBER_PERMISSIONS,
  ORGANISATION_ROLE_PERMISSIONS,
  ORGANISATION_WALLET_PERMISSIONS,
} from '#aiglebusiness/organisation/presentation/admin/permissions.config'
import { MASS_TRANSFER_PERMISSIONS } from '#aiglebusiness/transfer/mass/presentation/admin/permissions.config'

/**
 * Inventaire des permissions du back-office, source de vérité de la table `permissions`.
 *
 * Toute feature qui déclare un catalogue doit l'ajouter ici, sinon ses permissions ne sont jamais
 * synchronisées et ses gardes refusent tout le monde. Le module est préchargé au démarrage : un
 * slug revendiqué par deux catalogues fait échouer le boot.
 */
export const ADMIN_PERMISSION_CATALOG = collectPermissions([
  AUDIT_PERMISSIONS,

  SERVICE_TYPE_PERMISSIONS,
  PAYMENT_METHOD_PERMISSIONS,
  PROVIDER_PERMISSIONS,
  PRICING_PERMISSIONS,
  COMPANY_CONTACT_PERMISSIONS,

  KYC_PERMISSIONS,
  KYC_LEVEL_PERMISSIONS,
  USER_PERMISSIONS,
  DEVICE_PERMISSIONS,
  APP_VERSION_PERMISSIONS,

  LEDGER_PERMISSIONS,
  USER_LEDGER_PERMISSIONS,
  TRANSACTION_PERMISSIONS,
  USER_TRANSACTION_PERMISSIONS,
  REFUND_PERMISSIONS,
  USER_WALLET_PERMISSIONS,
  WALLET_ADJUSTMENT_PERMISSIONS,

  ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,

  FUNDING_REQUEST_PERMISSIONS,
  FUNDING_SETTINGS_PERMISSIONS,
  COLLECTION_ACCOUNT_PERMISSIONS,
  ORGANISATION_PERMISSIONS,
  ORGANISATION_MEMBER_PERMISSIONS,
  ORGANISATION_ROLE_PERMISSIONS,
  ORGANISATION_WALLET_PERMISSIONS,
  MASS_TRANSFER_PERMISSIONS,
])
