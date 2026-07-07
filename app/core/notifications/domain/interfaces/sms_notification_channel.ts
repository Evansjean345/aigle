import NotificationChannel from '#core/notifications/domain/interfaces/notification_channel'

/**
 * Canal de notification supportant l'envoi direct d'un SMS à un numéro, en plus
 * de l'envoi standard (send). Port implémenté par l'infrastructure.
 */
export default abstract class SmsNotificationChannel extends NotificationChannel {
  /**
   * Envoie un SMS brut vers un numéro de téléphone.
   */
  abstract sendSms(message: string, phone: string): Promise<any>
}
