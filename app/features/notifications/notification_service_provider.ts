import type { ApplicationService } from '@adonisjs/core/types'
import NotificationChannel from '#features/notifications/domain/interfaces/notification_channel'
import ExpoPushNotificationChannel from '#features/notifications/infrastructure/channels/expo_push_notification_channel'
import SmsNotificationChannel from '#features/notifications/infrastructure/channels/sms_notification_channel'
import EmailNotificationChannel from '#features/notifications/infrastructure/channels/email_notification_channel'

export default class NotificationServiceProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
   */
  register() {
    const providers = new Map<any, any>([
      [NotificationChannel, ExpoPushNotificationChannel],
      [NotificationChannel, SmsNotificationChannel],
      [NotificationChannel, EmailNotificationChannel],
    ])

    for (const [contract, implementation] of providers) {
      this.app.container.singleton(contract, () => {
        return new implementation()
      })
    }
  }

  /**
   * The container bindings have booted
   */
  async boot() {}

  /**
   * The application has been booted
   */
  async start() {}

  /**
   * The process has been started
   */
  async ready() {}

  /**
   * Preparing to shutdown the app
   */
  async shutdown() {}
}
