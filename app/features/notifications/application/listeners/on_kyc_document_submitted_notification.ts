import NotificationService from '#features/notifications/application/services/notification_service'
import KycDocumentSubmitted from '#features/kyc/application/events/kyc_document_submitted'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { inject } from '@adonisjs/core'

@inject()
export default class OnKycDocumentSubmittedNotification {
  /**
   * Constructor
   * @param notificationService
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Handle the event.
   * @param event
   */
  async handle(event: KycDocumentSubmitted) {
    const notification = new Notification(
      event.userId,
      'Documents soumis 📄',
      'Vos documents KYC ont été soumis avec succès et sont en cours de vérification. ⏳'
    )

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
