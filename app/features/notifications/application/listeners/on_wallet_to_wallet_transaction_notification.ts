import { inject } from '@adonisjs/core'
import Transaction from '#features/transactions/domain/models/transaction'
import NotificationService from '#features/notifications/application/services/notificaton_service'
import WalletToWalletTransactionCompleted from '#features/operations/application/events/wallet_to_wallet_transaction_completed'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'

@inject()
export default class WalletToWalletTransactionNotification {
  /**
   *
   * @param notificationService
   */
  constructor(private readonly notificationService: NotificationService) {}

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
    const notification = new Notification(
      transaction.usersUid,
      'Transfert effectué avec succès',
      `Vous avez effectué un transfert de ${transaction.amount} F CFA vers le numéro ${recipienPhone}. Nouveau solde: ${transaction.balanceAfter} CFA. Référence: ${transaction.reference}`
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }

  /**
   * Send push notification to the user when a wallet to wallet transaction is completed
   *
   * @param transaction
   * @param from
   * @private
   */
  private async sendWalletToWalletDepositNotification(transaction: Transaction, from: string) {
    const notification = new Notification(
      transaction.usersUid,
      'Transfert reçu',
      `Vous avez reçu un transfert de ${transaction.amount} F CFA de la part du ${from}. Nouveau solde: ${transaction.balanceAfter} CFA. Référence: ${transaction.reference}`
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
