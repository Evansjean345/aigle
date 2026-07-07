import NotificationService from '#core/notifications/application/services/notification_service'
import UserKycStatusUpdated from '#core/identity/user/application/events/user_kyc_status_updated'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import { UserKycStatus } from '#core/identity/user/domain/enum'
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
  async handle(event: UserKycStatusUpdated) {
    if (event.status !== UserKycStatus.VERIFIED && event.status !== UserKycStatus.REJECTED) {
      return
    }

    const isApproved = event.status === UserKycStatus.VERIFIED
    const title = isApproved ? 'KYC Approuvé ✅' : 'KYC Rejeté ❌'
    let message = isApproved
      ? 'Félicitations ! Vos documents KYC ont été approuvés avec succès. 🎉'
      : 'Désolé, vos documents KYC ont été rejetés. 😕'

    if (event.status === UserKycStatus.REJECTED && event.comment) {
      message += ` Raison : ${event.comment}`
    }

    const notification = new Notification(event.userId, title, message)
    await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
  }
}
