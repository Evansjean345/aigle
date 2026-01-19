import NotificationService from '#features/notifications/application/services/notificaton_service'
import KycDocumentProcessed from '#features/kyc/application/events/kyc_document_processed'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { KycDocumentStatus } from '#features/kyc/domain/enum/kyc_enum'
import { inject } from '@adonisjs/core'

@inject()
export default class OnKycDocumentProcessedNotification {
  /**
   * Constructor
   * @param notificationService
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Handle the event.
   * @param event
   */
  async handle(event: KycDocumentProcessed) {
    const isApproved = event.status === KycDocumentStatus.APPROVED
    const title = isApproved ? 'KYC Approuvé ✅' : 'KYC Rejeté ❌'
    let message = isApproved
      ? 'Félicitations ! Vos documents KYC ont été approuvés avec succès. 🎉'
      : 'Désolé, vos documents KYC ont été rejetés. 😕'

    if (event.comment) {
      message += ` Raison : ${event.comment}`
    }

    const notification = new Notification(event.userId, title, message)

    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
