import { inject } from '@adonisjs/core'
import Transaction from '#core/money/transactions/domain/models/transaction'
import NotificationService from '#core/notifications/application/services/notification_service'
import WalletToWalletTransactionCompleted from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

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
    // Paiement marchand : le **destinataire** (compte org sans user) est notifié par la couche
    // produit (`OnMerchantPaymentReceivedNotification`, encaissement). Mais le **payeur** est un
    // utilisateur aiglesend : il doit être notifié de son paiement (comme un dépôt/transfert).
    if (event.payload.type === 'merchant') {
      await this.sendMerchantPaymentNotification(
        event.senderTransaction,
        event.payload.senderBalanceAfter
      )
      return
    }

    // P2P (user ↔ user) : on notifie les deux côtés. Les soldes viennent de l'event (R9 : le modèle
    // `Transaction` ne porte pas `balanceAfter`).
    await Promise.all([
      this.sendWalletToWalletTransfertNotification(
        event.senderTransaction,
        event.payload.recipientPhone,
        event.payload.senderBalanceAfter
      ),
      this.sendWalletToWalletDepositNotification(
        event.receiverTransaction,
        event.payload.senderPhone,
        event.payload.recipientBalanceAfter
      ),
    ])
  }

  /**
   * Notifie le **payeur** (utilisateur aiglesend) de son paiement marchand. La description de la
   * transaction porte déjà « Paiement à {marchand} » ; on confirme montant, nouveau solde et référence.
   *
   * @param transaction Jambe débit (payeur).
   * @param balanceAfter Solde du payeur après le paiement (porté par l'event).
   * @private
   */
  private async sendMerchantPaymentNotification(transaction: Transaction, balanceAfter: number) {
    // Le payeur est un utilisateur consumer : sa notif ne cible que son app aiglesend.
    const notification = new Notification(
      transaction.usersUid,
      'Paiement effectué',
      `Vous avez effectué un paiement de ${transaction.amount} F CFA. Nouveau solde: ${balanceAfter} CFA. Référence: ${transaction.reference}`,
      undefined,
      AppName.AIGLESEND
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }

  /**
   * Send push notification to the user when a wallet to wallet transaction is completed
   *
   * @param transaction
   * @param recipienPhone
   * @param balanceAfter Solde de l'émetteur après le transfert (porté par l'event).
   * @private
   */
  private async sendWalletToWalletTransfertNotification(
    transaction: Transaction,
    recipienPhone: string | null,
    balanceAfter: number
  ) {
    const notification = new Notification(
      transaction.usersUid,
      'Transfert effectué avec succès',
      `Vous avez effectué un transfert de ${transaction.amount} F CFA vers le numéro ${recipienPhone}. Nouveau solde: ${balanceAfter} CFA. Référence: ${transaction.reference}`,
      undefined,
      AppName.AIGLESEND
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }

  /**
   * Send push notification to the user when a wallet to wallet transaction is completed
   *
   * @param transaction
   * @param from
   * @param balanceAfter Solde du bénéficiaire après réception (porté par l'event).
   * @private
   */
  private async sendWalletToWalletDepositNotification(
    transaction: Transaction,
    from: string,
    balanceAfter: number
  ) {
    const notification = new Notification(
      transaction.usersUid,
      'Transfert reçu',
      `Vous avez reçu un transfert de ${transaction.amount} F CFA de la part du ${from}. Nouveau solde: ${balanceAfter} CFA. Référence: ${transaction.reference}`,
      undefined,
      AppName.AIGLESEND
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
