import { inject } from '@adonisjs/core'
import DeviceService from '#shared/services/device_service'
import ExpoPushNotificationService from '#shared/services/notification/expo_push_notification_service'
import WalletToWalletTransactionCompleted from '#mobile/operations/events/wallet_to_wallet_transaction_completed'
import Transaction from '#shared/models/transaction'

@inject()
export default class WalletToWalletTransactionPushNotificationListener {
  /**
   *
   * @param deviceService
   */
  constructor(private readonly deviceService: DeviceService) {}

  /**
   * Handle the event when a wallet to wallet transaction is completed
   * @param event
   */
  async handle(event: WalletToWalletTransactionCompleted) {
    await Promise.all([
      this.sendWalletToWalletTransfertNotification(
        event.senderTransaction,
        event.payload.recipienPhone
      ),
      this.sendWalletToWalletDepositNotification(
        event.receiverTransaction,
        event.payload.senderPhone
      ),
    ])
  }

  /**
   * Send push notification to the user when a wallet to wallet transaction is completed
   *
   * @param transaction
   * @param recipienPhone
   * @private
   */
  private async sendWalletToWalletTransfertNotification(
    transaction: Transaction,
    recipienPhone: string
  ) {
    const devices = await this.deviceService.getDeviceByUserId(transaction.usersUid)

    if (devices.length === 0) {
      return
    }

    let tokens = []

    for (const device of devices) {
      tokens.push(device.token)
    }

    const message = `Vous avez effectué un transfert de ${transaction.amount} F CFA vers le numéro ${recipienPhone}. Nouveau solde: ${transaction.balanceAfter} CFA. Référence: ${transaction.reference}`

    const expoPushNotification = new ExpoPushNotificationService()
    await expoPushNotification
      .setPushToken(tokens)
      .setTitle('Transfert effectué avec succès')
      .setBody(message)
      .send()
  }

  /**
   * Send push notification to the user when a wallet to wallet transaction is completed
   *
   * @param transaction
   * @param from
   * @private
   */
  private async sendWalletToWalletDepositNotification(transaction: Transaction, from: string) {
    const devices = await this.deviceService.getDeviceByUserId(transaction.usersUid)
    if (devices.length === 0) {
      return
    }

    let tokens = []

    for (const device of devices) {
      tokens.push(device.token)
    }

    const message = `Vous avez reçu un transfert de ${transaction.amount} F CFA de la part du ${from}. Nouveau solde: ${transaction.balanceAfter} CFA. Référence: ${transaction.reference}`

    const expoPushNotification = new ExpoPushNotificationService()
    await expoPushNotification
      .setPushToken(tokens)
      .setTitle('Transfert reçu')
      .setBody(message)
      .send()
  }
}
