// import Event from '@ioc:Adonis/Core/Event'
// import Logger from '@ioc:Adonis/Core/Logger'
// import Database from '@ioc:Adonis/Lucid/Database'
// import Application from '@ioc:Adonis/Core/Application'

import emitter from '@adonisjs/core/services/emitter'
import WalletToWalletTransactionCompleted from '#mobile/operations/events/wallet_to_wallet_transaction_completed'
import DepositTransactionCompleted from '#mobile/webhooks/events/deposit/deposit_transaction_completed'
import TransfertTransactionCompleted from '#mobile/webhooks/events/transfert/transfert_transaction_completed'
const WalletToWalletTransactionPushNotificationListener = () =>
  import('#mobile/operations/listeners/wallet_to_wallet_transaction_push_notification_listener')

const DepositSuccessNotification = () =>
  import('#mobile/webhooks/listeners/deposit_success_notification')

const TransfertSuccessNotification = () =>
  import('#mobile/webhooks/listeners/transfert_success_notification')

emitter.on(DepositTransactionCompleted, [DepositSuccessNotification])
emitter.on(TransfertTransactionCompleted, [TransfertSuccessNotification])
emitter.on(WalletToWalletTransactionCompleted, [WalletToWalletTransactionPushNotificationListener])
