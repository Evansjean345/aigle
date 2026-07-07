import NotificationChannel from '#core/notifications/domain/interfaces/notification_channel'
import { type Notification } from '#core/notifications/domain/notification'

/**
 * Canal de notification supportant l'envoi push vers des tokens explicites,
 * en plus de l'envoi standard (send). Port implémenté par l'infrastructure.
 */
export default abstract class PushNotificationChannel extends NotificationChannel {
  /**
   * Envoie la notification directement vers une liste de tokens push.
   */
  abstract sendToTokens(tokens: string[], notification: Notification): Promise<void>
}
