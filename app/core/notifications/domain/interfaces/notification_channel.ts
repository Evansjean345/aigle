import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'

/**
 * Defines the interface for a notification channel.
 */
export default abstract class NotificationChannel {
  abstract name: NotificationChannelType
  abstract send(notification: Notification): Promise<void>
}
