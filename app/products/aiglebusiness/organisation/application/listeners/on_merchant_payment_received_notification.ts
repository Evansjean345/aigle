import { inject } from '@adonisjs/core'
import NotificationService from '#core/notifications/application/services/notification_service'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import WalletToWalletTransactionCompleted from '#core/money/transactions/application/events/wallet_to_wallet_transaction_completed'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
import Organisation from '#aiglebusiness/organisation/domain/models/organisation'

/**
 * Notifie le marchand d'un **encaissement interne** (paiement marchand par wallet : un utilisateur
 * aiglesend paie un marchand). Jumeau produit de [[OnCheckoutReceivedNotification]] pour le chemin
 * **interne** (`internal_move`, event `WalletToWalletTransactionCompleted`) — l'encaissement externe
 * (checkout) est déjà couvert par le listener deposit.
 *
 * Self-filtre sur `payload.type === 'merchant'` : le listener consumer
 * (`WalletToWalletTransactionNotification`) ignore ce même flag et **délègue** ici la notif marchand
 * (discriminateur d'event : un seul event, chaque listener se filtre). Résolution produit :
 * `recipientAccountId` (= `organisationId`) → organisation → **propriétaire** (owner-only, MVP).
 */
@inject()
export default class OnMerchantPaymentReceivedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: WalletToWalletTransactionCompleted): Promise<void> {
    if (event.payload.type !== 'merchant') return

    // `accountId` d'un compte marchand == `organisationId` (dérivé, sans jointure core→produit).
    const organisation = await Organisation.findBy(
      'organisationId',
      event.payload.recipientAccountId
    )
    if (!organisation) return

    // La jambe **crédit** (receiverTransaction) porte le montant reçu par le marchand + sa référence.
    const received = event.receiverTransaction

    // `targetApp = aiglebusiness` : l'encaissement est une notif **marchand** — elle ne doit partir
    // que vers l'app business du propriétaire, pas vers son app aiglesend (consumer).
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
