import NotificationService from '#core/notifications/application/services/notification_service'
import { consumerRecipient } from '#core/notifications/domain/consumer_recipient'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import TransfertTransactionCompleted from '#core/money/transactions/application/events/transfert_transaction_completed'
import { AppName } from '#core/identity/authentication/domain/enums/app_name'
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
    const recipient = consumerRecipient(event.data)
    if (!recipient) return

    const notification = new Notification(
      recipient,
      'Transfert effectué avec succès',
      `Vous avez effectué un transfert de ${event.data.amount} F CFA vers le compte ${event.data.beneficiaryPhone}. Nouveau solde: ${event.data.balanceAfter} CFA. Référence: ${event.data.reference}`,
      undefined,
      AppName.AIGLESEND
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
