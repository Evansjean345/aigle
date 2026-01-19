import emitter from '@adonisjs/core/services/emitter'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'
import DepositTransactionCompleted from '#features/webhooks/application/events/deposit/deposit_transaction_completed'
import TransfertTransactionCompleted from '#features/webhooks/application/events/transfert/transfert_transaction_completed'
import KycDocumentSubmitted from '#features/kyc/application/events/kyc_document_submitted'
import KycDocumentProcessed from '#features/kyc/application/events/kyc_document_processed'

const WalletToWalletTransactionPushNotificationListener = () =>
  import('#features/notifications/application/listeners/on_wallet_to_wallet_transaction_notification')

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
emitter.on(KycDocumentProcessed, [OnKycDocumentProcessedNotification])
