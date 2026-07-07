import { inject } from '@adonisjs/core'
import Transaction from '#core/money/transactions/domain/models/transaction'
import NotificationService from '#core/notifications/application/services/notification_service'
import WalletToWalletTransactionCompleted from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'

@inject()
export default class WalletToWalletTransactionNotification {
  /**
   *
   * @param notificationService
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Handles the completion of a wallet-to-wallet transaction by sending notifications
   * to both the sender and the receiver.
   *
   * @param {WalletToWalletTransactionCompleted} event - The event object containing details
   *    about the completed wallet-to-wallet transaction, including sender and receiver data.
   * @return {Promise<void>} A promise that resolves when the notifications have been sent.
   */
  async handle(event: WalletToWalletTransactionCompleted): Promise<void> {
    await Promise.all([
      this.sendWalletToWalletTransfertNotification(
        event.senderTransaction,
        event.payload.recipientPhone
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
