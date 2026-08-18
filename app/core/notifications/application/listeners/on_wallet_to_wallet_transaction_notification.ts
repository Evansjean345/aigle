import { inject } from '@adonisjs/core'
import NotificationService from '#core/notifications/application/services/notification_service'
import WalletToWalletTransactionCompleted, {
  type WalletToWalletLeg,
} from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'

@inject()
export default class WalletToWalletTransactionNotification {
  /**
   * Construit l'écouteur.
   *
   * @param {NotificationService} notificationService - Envoi des notifications.
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Notifie les parties d'un mouvement de portefeuille à portefeuille abouti.
   *
   * @param {WalletToWalletTransactionCompleted} event - Les deux jambes et le contexte.
   * @returns {Promise<void>} Rien : l'envoi ne bloque pas le mouvement.
   */
  async handle(event: WalletToWalletTransactionCompleted): Promise<void> {
    const { sender, recipient, type } = event.payload

    // Sur un paiement marchand, le marchand est notifié par la couche produit : ici, seul le payeur
    // l'est. Le notifier des deux côtés lui enverrait deux fois le même paiement.
    if (type === 'merchant') {
      await this.sendMerchantPaymentNotification(sender)
      return
    }

    // Chaque partie est nommée à l'autre par son numéro : le message parle de la jambe d'en face.
    await Promise.all([
      this.sendWalletToWalletTransfertNotification(sender, recipient.phone),
      this.sendWalletToWalletDepositNotification(recipient, sender.phone),
    ])
  }

  /**
   * Notifie le payeur de son paiement marchand.
   *
   * @param {WalletToWalletLeg} sender - Jambe du payeur.
   * @returns {Promise<void>} Rien : l'envoi ne bloque pas le mouvement.
   */
  private async sendMerchantPaymentNotification(sender: WalletToWalletLeg): Promise<void> {
    // Le payeur est un utilisateur consumer : sa notif ne cible que son app aiglesend.
    const notification = new Notification(
      sender.accountId,
      'Paiement effectué',
      `Vous avez effectué un paiement de ${sender.amount} F CFA. Nouveau solde: ${sender.balanceAfter} CFA. Référence: ${sender.reference}`,
      undefined,
      AppName.AIGLESEND
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }

  /**
   * Notifie l'émetteur d'un transfert entre portefeuilles.
   *
   * @param {WalletToWalletLeg} sender - Jambe de l'émetteur.
   * @param {string | null} recipientPhone - Numéro du bénéficiaire, tel que la ligne l'affiche.
   * @returns {Promise<void>} Rien : l'envoi ne bloque pas le mouvement.
   */
  private async sendWalletToWalletTransfertNotification(
    sender: WalletToWalletLeg,
    recipientPhone: string | null
  ): Promise<void> {
    const notification = new Notification(
      sender.accountId,
      'Transfert effectué avec succès',
      `Vous avez effectué un transfert de ${sender.amount} F CFA vers le numéro ${recipientPhone}. Nouveau solde: ${sender.balanceAfter} CFA. Référence: ${sender.reference}`,
      undefined,
      AppName.AIGLESEND
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }

  /**
   * Notifie le bénéficiaire d'un transfert entre portefeuilles.
   *
   * @param {WalletToWalletLeg} recipient - Jambe du bénéficiaire.
   * @param {string | null} senderPhone - Numéro de l'émetteur, tel que la ligne l'affiche.
   * @returns {Promise<void>} Rien : l'envoi ne bloque pas le mouvement.
   */
  private async sendWalletToWalletDepositNotification(
    recipient: WalletToWalletLeg,
    senderPhone: string | null
  ): Promise<void> {
    const notification = new Notification(
      recipient.accountId,
      'Transfert reçu',
      `Vous avez reçu un transfert de ${recipient.amount} F CFA de la part du ${senderPhone}. Nouveau solde: ${recipient.balanceAfter} CFA. Référence: ${recipient.reference}`,
      undefined,
      AppName.AIGLESEND
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
