import { inject } from '@adonisjs/core'
import NotificationService from '#features/notifications/application/services/notification_service'
import UserStateChanged from '#features/user/application/events/user_state_changed'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { UserStatus } from '#features/user/domain/enum'

@inject()
export default class OnUserStateChangedNotification {
  /**
   * Creates a new instance of the class with a dependency on NotificationService.
   *
   * @param {NotificationService} notificationService - The service used to send notifications.
   */
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Handles the UserStateChanged event and sends a notification to the user.
   *
   * @param {UserStateChanged} event - The event containing information about the user's state change.
   * @return {Promise<void>} A promise that resolves when the notification has been sent.
   */
  async handle(event: UserStateChanged): Promise<void> {
    let title = ''
    let message = ''

    if (event.status === UserStatus.BLOCKED) {
      title = 'Compte Bloqué 🚫'
      message =
        "Votre compte a été bloqué par l'administration. Veuillez contacter le support pour plus d'informations."
    }

    if (event.status === UserStatus.ACTIVE) {
      title = 'Compte Activé ✅'
      message =
        'Votre compte a été activé avec succès. Vous pouvez maintenant utiliser nos services.'
    }

    if (title && message) {
      const notification = new Notification(event.userId, title, message)
      await this.notificationService.sendVia(NotificationChannelType.PushNotification, notification)
    }
  }
}
