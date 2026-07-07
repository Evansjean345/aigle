import type { ApplicationService } from '@adonisjs/core/types'
import NotificationChannel from '#core/notifications/domain/interfaces/notification_channel'
import PushNotificationChannel from '#core/notifications/domain/interfaces/push_notification_channel'
import SmsNotificationChannel from '#core/notifications/domain/interfaces/sms_notification_channel'
import ExpoPushNotificationChannelImpl from '#core/notifications/infrastructure/channels/expo_push_notification_channel_impl'
import SmsNotificationChannelImpl from '#core/notifications/infrastructure/channels/sms_notification_channel_impl'
import EmailNotificationChannelImpl from '#core/notifications/infrastructure/channels/email_notification_channel_impl'

export default class NotificationServiceProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container.
   *
   * Chaque port de canal est lié à son implémentation via container.make afin de
   * résoudre les dépendances de constructeur (ex : ExpoPush → DeviceService).
   * Le canal email « nu » (send seul) est exposé sous le port de base
   * NotificationChannel ; push et sms sous leurs ports de capacité.
   */
  register() {
    const bindings = new Map<any, any>([
      [PushNotificationChannel, ExpoPushNotificationChannelImpl],
      [SmsNotificationChannel, SmsNotificationChannelImpl],
      [NotificationChannel, EmailNotificationChannelImpl],
    ])

    for (const [contract, implementation] of bindings) {
      this.app.container.singleton(contract, () => this.app.container.make(implementation))
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
