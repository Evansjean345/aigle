import emitter from '@adonisjs/core/services/emitter'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'
import DepositTransactionCompleted from '#features/webhooks/application/events/deposit/deposit_transaction_completed'
import TransfertTransactionCompleted from '#features/webhooks/application/events/transfert/transfert_transaction_completed'
import WalletToWalletTransactionFailed from '#features/operations/application/events/wallet_to_wallet_transaction_failed'
import DepositTransactionFailed from '#features/webhooks/application/events/deposit/deposit_transaction_failed'
import TransfertTransactionFailed from '#features/webhooks/application/events/transfert/transfert_transaction_failed'
import TransfertInterTransactionFailed from '#features/webhooks/application/events/transfert_inter/transfert_inter_transaction_failed'
import KycDocumentSubmitted from '#features/kyc/application/events/kyc_document_submitted'
import KycDocumentProcessed from '#features/kyc/application/events/kyc_document_processed'
import UserKycStatusUpdated from '#features/user/application/events/user_kyc_status_updated'
import NewDeviceDetected from '#features/device/application/events/new_device_detected'
import UserStateChanged from '#features/user/application/events/user_state_changed'
import WalletStatusChanged from '#features/wallet/application/events/wallet_status_changed'

const AuditListener = () => import('#features/audit/application/listeners/audit_listener')

const WalletToWalletTransactionPushNotificationListener = () =>
  import(
    '#features/notifications/application/listeners/on_wallet_to_wallet_transaction_notification'
  )

const PersistUserTransactionsVolumeListener = () =>
  import('#features/transactions/application/listeners/persist_user_transactions_volume')

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

const OnNewDeviceDetectedNotification = () =>
  import('#features/notifications/application/listeners/on_new_device_detected_notification')

const OnUserStateChangedNotification = () =>
  import('#features/notifications/application/listeners/on_user_state_changed_notification')
const OnWalletStatusChangedNotification = () =>
  import('#features/notifications/application/listeners/on_wallet_status_changed_notification')
const HandleTransactionFailure = () =>
  import('#features/transactions/application/listeners/handle_transaction_failure')

import { AuditRecordInput } from '#shared/infrastructure/logging/audit_service'

declare module '@adonisjs/core/types' {
  interface EventsList {
    'activity:audit': AuditRecordInput
  }
}

emitter.listen(DepositTransactionCompleted, [
  OnDepositSuccessNotification,
  PersistUserTransactionsVolumeListener,
])
emitter.listen(TransfertTransactionCompleted, [
  OnTransfertSuccessNotification,
  PersistUserTransactionsVolumeListener,
])
emitter.listen(WalletToWalletTransactionCompleted, [
  PersistUserTransactionsVolumeListener,
  WalletToWalletTransactionPushNotificationListener,
])
emitter.listen(KycDocumentSubmitted, [OnUserKycStatusUpdate, OnKycDocumentSubmittedNotification])
emitter.listen(KycDocumentProcessed, [OnUserKycStatusUpdate])
emitter.listen(UserKycStatusUpdated, [OnKycDocumentProcessedNotification])
emitter.listen(NewDeviceDetected, [OnNewDeviceDetectedNotification])
emitter.listen(UserStateChanged, [OnUserStateChangedNotification])
emitter.listen(WalletStatusChanged, [OnWalletStatusChangedNotification])

emitter.listen(DepositTransactionFailed, [HandleTransactionFailure])
emitter.listen(TransfertTransactionFailed, [HandleTransactionFailure])
emitter.listen(WalletToWalletTransactionFailed, [HandleTransactionFailure])
emitter.listen(TransfertInterTransactionFailed, [HandleTransactionFailure])

emitter.on('activity:audit', [AuditListener])
