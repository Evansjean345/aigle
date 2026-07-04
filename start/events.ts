import emitter from '@adonisjs/core/services/emitter'
import WalletToWalletTransactionCompleted from '#features/transactions/application/events/wallet_to_wallet_transaction_completed'
import DepositTransactionCompleted from '#features/transactions/application/events/deposit_transaction_completed'
import TransfertTransactionCompleted from '#features/transactions/application/events/transfert_transaction_completed'
import WalletToWalletTransactionFailed from '#features/transactions/application/events/wallet_to_wallet_transaction_failed'
import DepositTransactionFailed from '#features/transactions/application/events/deposit_transaction_failed'
import TransfertTransactionFailed from '#features/transactions/application/events/transfert_transaction_failed'
import TransfertInterTransactionFailed from '#features/transactions/application/events/transfert_inter_transaction_failed'
import KycDocumentSubmitted from '#features/kyc/application/events/kyc_document_submitted'
import KycDocumentProcessed from '#features/kyc/application/events/kyc_document_processed'
import UserKycStatusUpdated from '#features/user/application/events/user_kyc_status_updated'
import NewDeviceDetected from '#features/device/application/events/new_device_detected'
import UserStateChanged from '#features/user/application/events/user_state_changed'
import WalletStatusChanged from '#features/wallet/application/events/wallet_status_changed'

const AuditListener = () => import('#features/audit/application/listeners/audit_listener')

const WalletToWalletTransactionPushNotificationListener = () =>
  import('#features/notifications/application/listeners/on_wallet_to_wallet_transaction_notification')

const PersistUserTransactionsVolumeListener = () =>
  import('#features/transactions/application/listeners/persist_user_transactions_volume')

const ResetSecurityCountersOnSuccessListener = () =>
  import('#features/risk/application/listeners/reset_security_counters_on_success')

const OnDepositSuccessNotification = () =>
  import('#features/notifications/application/listeners/on_deposit_success_notification')

const OnTransfertSuccessNotification = () =>
  import('#features/notifications/application/listeners/on_transfert_success_notification')

const OnUserKycStatusUpdate = () =>
  import('#features/user/application/listeners/on_user_kyc_status_update')

const OnKycDocumentSubmittedNotification = () =>
  import('#features/notifications/application/listeners/on_kyc_document_submitted_notification')

const OnKycDocumentProcessedNotification = () =>
  import('#features/notifications/application/listeners/on_kyc_document_processed_notification')

const OnKycSubmittedAdminBroadcast = () =>
  import('#features/kyc/application/listeners/on_kyc_submitted_admin_broadcast')

const OnKycProcessedAdminBroadcast = () =>
  import('#features/kyc/application/listeners/on_kyc_processed_admin_broadcast')

const OnNewDeviceDetectedNotification = () =>
  import('#features/notifications/application/listeners/on_new_device_detected_notification')

const OnUserStateChangedNotification = () =>
  import('#features/notifications/application/listeners/on_user_state_changed_notification')
const OnWalletStatusChangedNotification = () =>
  import('#features/notifications/application/listeners/on_wallet_status_changed_notification')
const HandleTransactionFailure = () =>
  import('#features/risk/application/listeners/handle_transaction_failure')

import { type AuditRecordInput } from '#shared/infrastructure/logging/audit_service'
import { type TransactionLogEventData } from '#features/transactions/application/types/transaction_log_event_data'
import { type AdminProviderErrorAlertEvent } from '#features/notifications/domain/events/admin_alert_events'
import { type SecurityAlertEvent } from '#features/audit/application/types/security_alert_event'

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
  PersistUserTransactionsVolumeListener,
  ResetSecurityCountersOnSuccessListener,
])
emitter.listen(TransfertTransactionCompleted, [
  OnTransfertSuccessNotification,
  PersistUserTransactionsVolumeListener,
  ResetSecurityCountersOnSuccessListener,
])
emitter.listen(WalletToWalletTransactionCompleted, [
  PersistUserTransactionsVolumeListener,
  WalletToWalletTransactionPushNotificationListener,
  ResetSecurityCountersOnSuccessListener,
])
emitter.listen(KycDocumentSubmitted, [
  OnUserKycStatusUpdate,
  OnKycDocumentSubmittedNotification,
  OnKycSubmittedAdminBroadcast,
])
emitter.listen(KycDocumentProcessed, [OnUserKycStatusUpdate, OnKycProcessedAdminBroadcast])
emitter.listen(UserKycStatusUpdated, [OnKycDocumentProcessedNotification])
emitter.listen(NewDeviceDetected, [OnNewDeviceDetectedNotification])
emitter.listen(UserStateChanged, [OnUserStateChangedNotification])
emitter.listen(WalletStatusChanged, [OnWalletStatusChangedNotification])

emitter.listen(DepositTransactionFailed, [HandleTransactionFailure])
emitter.listen(TransfertTransactionFailed, [HandleTransactionFailure])
emitter.listen(WalletToWalletTransactionFailed, [HandleTransactionFailure])
emitter.listen(TransfertInterTransactionFailed, [HandleTransactionFailure])

const TransactionLogListener = () =>
  import('#features/transactions/application/listeners/transaction_log_listener')

const OnProviderErrorAlert = () =>
  import('#features/notifications/application/listeners/on_provider_error_alert')

const OnSecurityAlert = () =>
  import('#features/notifications/application/listeners/on_security_alert')

const SecurityAlertDetectorListener = () =>
  import('#features/audit/application/services/security_alert_detector')

emitter.on('activity:audit', [AuditListener])
emitter.on('activity:audit', [SecurityAlertDetectorListener])
emitter.on('activity:transaction-log', [TransactionLogListener])
emitter.on('alert:provider-error', [OnProviderErrorAlert])
emitter.on('alert:security', [OnSecurityAlert])
