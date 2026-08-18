import type { Notification } from '#core/notifications/domain/notification'
import type { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'

/**
 * Envoi de notifications retenu en mémoire.
 *
 * Reproduit la seule méthode que les écouteurs appellent, sans déclarer `NotificationService`
 * implémentée : c'est une classe concrète, pas un port. Elle est passée avec un cast là où le
 * service est attendu.
 */
export default class CapturingNotificationService {
  /** Envois reçus, dans l'ordre. */
  readonly calls: Array<{ channel: NotificationChannelType; notification: Notification }> = []

  /**
   * Retient un envoi au lieu de le remettre à un canal.
   *
   * @param {NotificationChannelType} channel - Le canal visé.
   * @param {Notification} notification - La notification envoyée.
   * @returns {Promise<void>} Rien.
   */
  async sendVia(channel: NotificationChannelType, notification: Notification): Promise<void> {
    this.calls.push({ channel, notification })
  }
}
