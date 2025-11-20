import emitter from '@adonisjs/core/services/emitter'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'
import DepositTransactionCompleted from '#features/webhooks/application/events/deposit/deposit_transaction_completed'
import TransfertTransactionCompleted from '#features/webhooks/application/events/transfert/transfert_transaction_completed'

const WalletToWalletTransactionPushNotificationListener = () =>
  import(
    '#features/notifications/application/listeners/on_wallet_to_wallet_transaction_notification'
  )

const OnDepositSuccessNotification = () =>
  import('#features/notifications/application/listeners/on_deposit_success_notification')

const OnTransfertSuccessNotification = () =>
  import('#features/notifications/application/listeners/on_transfert_success_notification')

emitter.on(DepositTransactionCompleted, [OnDepositSuccessNotification])
emitter.on(TransfertTransactionCompleted, [OnTransfertSuccessNotification])
emitter.on(WalletToWalletTransactionCompleted, [WalletToWalletTransactionPushNotificationListener])
