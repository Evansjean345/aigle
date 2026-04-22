import NotificationService from '#features/notifications/application/services/notification_service'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import TransfertTransactionCompleted from '#features/webhooks/application/events/transfert/transfert_transaction_completed'
import { inject } from '@adonisjs/core'

@inject()
export default class OnTransfertSuccessNotification {
  /**
   * Constructor
   * @param notificationService
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Handles the event triggered when a transfer transaction is completed.
   *
   * @param {TransfertTransactionCompleted} event - The event containing data about the completed transfer transaction.
   * @return {Promise<void>} A promise that resolves when the notification has been successfully sent.
   */
  async handle(event: TransfertTransactionCompleted): Promise<void> {
    const notification = new Notification(
      event.data.userId,
      'Transfert effectué avec succès',
      `Vous avez effectué un transfert de ${event.data.amount} F CFA vers le compte ${event.data.beneficiaryPhone}. Nouveau solde: ${event.data.balanceAfter} CFA. Référence: ${event.data.reference}`
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
