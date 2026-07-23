import emitter from '@adonisjs/core/services/emitter'
import WalletToWalletTransactionCompleted from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'
import DepositTransactionCompleted from '#core/money/transactions/application/events/deposit_transaction_completed'
import TransfertTransactionCompleted from '#core/money/transactions/application/events/transfert_transaction_completed'
import WalletToWalletTransactionFailed from '#core/money/transactions/application/events/wallet_to_wallet_transaction_failed'
import DepositTransactionFailed from '#core/money/transactions/application/events/deposit_transaction_failed'
import TransfertTransactionFailed from '#core/money/transactions/application/events/transfert_transaction_failed'
import TransfertInterTransactionFailed from '#core/money/transactions/application/events/transfert_inter_transaction_failed'
import KycDocumentSubmitted from '#core/identity/kyc/application/events/kyc_document_submitted'
import KycDocumentProcessed from '#core/identity/kyc/application/events/kyc_document_processed'
import UserKycStatusUpdated from '#core/identity/user/application/events/user_kyc_status_updated'
import NewDeviceDetected from '#core/identity/device/application/events/new_device_detected'
import UserStateChanged from '#core/identity/user/application/events/user_state_changed'
import WalletStatusChanged from '#core/money/wallet/application/events/wallet_status_changed'
import AccountOpened from '#core/identity/account/application/events/account_opened'

const AuditListener = () => import('#core/audit/application/listeners/audit_listener')

const WalletToWalletTransactionPushNotificationListener = () =>
  import('#core/notifications/application/listeners/on_wallet_to_wallet_transaction_notification')

const PersistUserTransactionsVolumeListener = () =>
  import('#core/money/transactions/application/listeners/persist_user_transactions_volume')

const ResetSecurityCountersOnSuccessListener = () =>
  import('#core/money/risk/application/listeners/reset_security_counters_on_success')

const OnDepositSuccessNotification = () =>
  import('#core/notifications/application/listeners/on_deposit_success_notification')

const OnCheckoutReceivedNotification = () =>
  import('#aiglebusiness/organisation/application/listeners/on_checkout_received_notification')

const OnMerchantPaymentReceivedNotification = () =>
  import('#aiglebusiness/organisation/application/listeners/on_merchant_payment_received_notification')

const OnTransfertSuccessNotification = () =>
  import('#core/notifications/application/listeners/on_transfert_success_notification')

const OnUserKycStatusUpdate = () =>
  import('#core/identity/user/application/listeners/on_user_kyc_status_update')

const OnKycDocumentSubmittedNotification = () =>
  import('#core/notifications/application/listeners/on_kyc_document_submitted_notification')

const OnKycDocumentProcessedNotification = () =>
  import('#core/notifications/application/listeners/on_kyc_document_processed_notification')

const OnKycSubmittedAdminBroadcast = () =>
  import('#core/identity/kyc/application/listeners/on_kyc_submitted_admin_broadcast')

const OnKycProcessedAdminBroadcast = () =>
  import('#core/identity/kyc/application/listeners/on_kyc_processed_admin_broadcast')

const OnNewDeviceDetectedNotification = () =>
  import('#core/notifications/application/listeners/on_new_device_detected_notification')

const OnUserStateChangedNotification = () =>
  import('#core/notifications/application/listeners/on_user_state_changed_notification')
const OnWalletStatusChangedNotification = () =>
  import('#core/notifications/application/listeners/on_wallet_status_changed_notification')
const CreateWalletOnAccountOpened = () =>
  import('#core/money/wallet/application/listeners/create_wallet_on_account_opened')
const SyncAccountStatusOnUserStateChanged = () =>
  import('#core/identity/account/application/listeners/sync_account_status_on_user_state_changed')
const SyncAccountLevelOnKycUpdated = () =>
  import('#core/identity/account/application/listeners/sync_account_level_on_kyc_updated')
const HandleTransactionFailure = () =>
  import('#core/money/risk/application/listeners/handle_transaction_failure')
const TransferItemSettledListener = () =>
  import('#core/money/transfer/application/listeners/transfer_item_settled_listener')

import { type AuditRecordInput } from '#core/audit/domain/audit_record_input'
import { type TransactionLogEventData } from '#core/money/transactions/application/types/transaction_log_event_data'
import { type AdminProviderErrorAlertEvent } from '#core/notifications/domain/events/admin_alert_events'
import { type SecurityAlertEvent } from '#core/audit/application/types/security_alert_event'

declare module '@adonisjs/core/types' {
  interface EventsList {
    'activity:audit': AuditRecordInput
    'activity:transaction-log': TransactionLogEventData
    'alert:provider-error': AdminProviderErrorAlertEvent
    'alert:security': SecurityAlertEvent
  }
}

emitter.listen(DepositTransactionCompleted, [
  OnDepositSuccessNotification,
  OnCheckoutReceivedNotification,
  PersistUserTransactionsVolumeListener,
  ResetSecurityCountersOnSuccessListener,
])
emitter.listen(TransfertTransactionCompleted, [
  OnTransfertSuccessNotification,
  PersistUserTransactionsVolumeListener,
  ResetSecurityCountersOnSuccessListener,
  TransferItemSettledListener,
])
emitter.listen(WalletToWalletTransactionCompleted, [
  PersistUserTransactionsVolumeListener,
  WalletToWalletTransactionPushNotificationListener,
  OnMerchantPaymentReceivedNotification,
  ResetSecurityCountersOnSuccessListener,
])
emitter.listen(KycDocumentSubmitted, [
  OnUserKycStatusUpdate,
  OnKycDocumentSubmittedNotification,
  OnKycSubmittedAdminBroadcast,
])
emitter.listen(KycDocumentProcessed, [OnUserKycStatusUpdate, OnKycProcessedAdminBroadcast])
emitter.listen(UserKycStatusUpdated, [
  OnKycDocumentProcessedNotification,
  SyncAccountLevelOnKycUpdated,
])
emitter.listen(NewDeviceDetected, [OnNewDeviceDetectedNotification])
emitter.listen(UserStateChanged, [
  OnUserStateChangedNotification,
  SyncAccountStatusOnUserStateChanged,
])
emitter.listen(WalletStatusChanged, [OnWalletStatusChangedNotification])
emitter.listen(AccountOpened, [CreateWalletOnAccountOpened])

emitter.listen(DepositTransactionFailed, [HandleTransactionFailure])
emitter.listen(TransfertTransactionFailed, [HandleTransactionFailure, TransferItemSettledListener])
emitter.listen(WalletToWalletTransactionFailed, [HandleTransactionFailure])
emitter.listen(TransfertInterTransactionFailed, [HandleTransactionFailure])

const TransactionLogListener = () =>
  import('#core/money/transactions/application/listeners/transaction_log_listener')

const OnProviderErrorAlert = () =>
  import('#core/notifications/application/listeners/on_provider_error_alert')

const OnSecurityAlert = () => import('#core/notifications/application/listeners/on_security_alert')

const SecurityAlertDetectorListener = () =>
  import('#core/audit/application/services/security_alert_detector')

emitter.on('activity:audit', [AuditListener])
emitter.on('activity:audit', [SecurityAlertDetectorListener])
emitter.on('activity:transaction-log', [TransactionLogListener])
emitter.on('alert:provider-error', [OnProviderErrorAlert])
emitter.on('alert:security', [OnSecurityAlert])
