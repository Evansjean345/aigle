import { inject } from '@adonisjs/core'
import NotificationService from '#core/notifications/application/services/notification_service'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import DepositTransactionCompleted from '#core/money/transactions/application/events/deposit_transaction_completed'
import Organisation from '#aiglebusiness/organisation/domain/models/organisation'

/**
 * Notifie le marchand d'un **encaissement** (checkout réglé). Listener PRODUIT (aiglebusiness) :
 * s'abonne à l'event core `DepositTransactionCompleted` et **self-filtre** sur `type: 'checkout'`
 * (les autres flux — deposit consumer — sont ignorés, cf. discriminateur d'event).
 *
 * Résolution produit : `accountId` (= `organisationId`) → organisation → **propriétaire**. MVP :
 * seul le propriétaire est notifié (owner-only). Le fan-out équipe est un choix ultérieur.
 */
@inject()
export default class OnCheckoutReceivedNotification {
  constructor(private readonly notificationService: NotificationService) {}

  async handle(event: DepositTransactionCompleted) {
    if (event.data.type !== 'checkout') return

    // `accountId` d'un compte marchand == `organisationId` (dérivé, sans jointure core→produit).
    const organisation = await Organisation.findBy('organisationId', event.data.accountId)
    if (!organisation) return

    const notification = new Notification(
      organisation.ownerUserId,
      'Paiement reçu',
      `Vous avez reçu un paiement de ${event.data.amount} F CFA. Référence: ${event.data.reference}`
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
