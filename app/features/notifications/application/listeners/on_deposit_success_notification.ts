import NotificationService from '#features/notifications/application/services/notificaton_service'
import DepositTransactionCompleted from '#features/webhooks/application/events/deposit/deposit_transaction_completed'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { inject } from '@adonisjs/core'

@inject()
export default class OnDepositSuccessNotification {
  /**
   * Constructor
   * @param notificationService
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Handle the event.
   * @param event
   */
  async handle(event: DepositTransactionCompleted) {
    const notification = new Notification(
      event.data.userId,
      'Dépot effectué avec succès',
      `Votre dépôt de ${event.data.amount} F CFA a été crédité sur votre compte. Nouveau solde: ${event.data.balanceAfter} CFA. Référence: ${event.data.reference}`
    )

    console.log('debugging notification:')
    console.log(notification)

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
