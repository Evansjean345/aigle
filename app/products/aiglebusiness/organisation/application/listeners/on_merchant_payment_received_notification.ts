import { inject } from '@adonisjs/core'
import NotificationService from '#core/notifications/application/services/notification_service'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import WalletToWalletTransactionCompleted from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import Organisation from '#aiglebusiness/organisation/domain/models/organisation'

/** Prévient le propriétaire d'une organisation qu'un utilisateur vient de la payer. */
@inject()
export default class OnMerchantPaymentReceivedNotification {
  /**
   * Construit l'écouteur.
   *
   * @param {NotificationService} notificationService - Envoi des notifications.
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Notifie le propriétaire de l'organisation encaissée.
   *
   * @param {WalletToWalletTransactionCompleted} event - Les deux jambes du mouvement et sa nature.
   * @returns {Promise<void>} Rien : un compte sans organisation connue n'envoie rien.
   */
  async handle(event: WalletToWalletTransactionCompleted): Promise<void> {
    if (event.payload.type !== 'merchant') return

    // Le compte d'un marchand porte l'identifiant de son organisation : la résoudre ne demande
    // aucune jointure du core vers le produit.
    const organisation = await Organisation.findBy(
      'organisationId',
      event.payload.recipient.accountId
    )

    if (!organisation) return

    const received = event.payload.recipient

    // L'encaissement ne part que vers l'app business : un seul envoi Expo ne peut pas mêler les
    // appareils de deux projets.
    const notification = new Notification(
      organisation.ownerUserId,
      'Paiement reçu',
      `Vous avez reçu un paiement de ${received.amount} F CFA. Référence: ${received.reference}`,
      undefined,
      AppName.AIGLEBUSINESS
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
