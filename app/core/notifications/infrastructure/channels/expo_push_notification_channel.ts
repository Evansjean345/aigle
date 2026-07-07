import NotificationChannel from '#core/notifications/domain/interfaces/notification_channel'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import { Expo } from 'expo-server-sdk'
import { Notification } from '#core/notifications/domain/notification'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import DeviceService from '#core/identity/device/application/services/device_service'
import notificationLog from '#shared/infrastructure/logging/notification_log'
import errorLog from '#shared/infrastructure/logging/error_log'

@inject()
export default class ExpoPushNotificationChannel implements NotificationChannel {
  name = NotificationChannelType.PushNotification
  #expoInstance: Expo

  /**
   * Creates an instance of the class and initializes necessary dependencies and properties.
   *
   * @param deviceService
   */
  constructor(private readonly deviceService: DeviceService) {
    this.#expoInstance = new Expo()
  }

  /**
   * Sends a notification to the recipient's trusted devices using Expo push notifications.
   *
   * @param {Notification} notification - The notification object containing details such as recipient ID, title, message, and optional data.
   * @return {Promise<void>} A promise that resolves when the notification sending operation completes.
   * @throws {Exception} If no push tokens are found for the recipient.
   */
  async send(notification: Notification): Promise<void> {
    const userDevices = await this.deviceService.getTrustedDevices(notification.recipientId)

    if (userDevices.length === 0) return
    const tokens = userDevices.map((ud) => ud.pushToken)

    if (!tokens || tokens.length === 0) {
      notificationLog.warn(
        'NO_PUSH_TOKENS_FOUND',
        { recipientId: notification.recipientId },
        'No push tokens found for user'
      )

      throw new Exception('No push tokens found', {
        status: 400,
        code: 'NO_PUSH_TOKENS_FOUND',
      })
    }

    const messages = []

    for (const token of tokens) {
      if (Expo.isExpoPushToken(token)) {
        messages.push({
          to: token,
          title: notification.title,
          sound: 'default',
          body: notification.message,
          data: notification.data ?? {},
        })
      }
    }

    if (messages.length === 0) return

    try {
      await this.#expoInstance.sendPushNotificationsAsync(messages)
      notificationLog.info(
        'PUSH_SENT',
        {
          recipientId: notification.recipientId,
          tokensCount: tokens.length,
          validTokensCount: messages.length,
        },
        'Push notifications sent via Expo'
      )
    } catch (error) {
      errorLog.error(
        'PUSH_SEND_ERROR',
        {
          recipientId: notification.recipientId,
          error: (error as Error)?.message || 'Unknown error',
        },
        'Error sending Expo push notification'
      )
    }
  }

  /**
   * Sends push notifications to the specified Expo push tokens.
   *
   * @param {string[]} tokens - An array of Expo push tokens to which the notification should be sent.
   * @param {Notification} notification - The notification object containing the title, message, and optional additional data.
   * @return {Promise<void>} A promise that resolves when the notifications have been sent or rejects if an error occurs.
   */
  async sendToTokens(tokens: string[], notification: Notification): Promise<void> {
    if (!tokens || tokens.length === 0) {
      return
    }

    const messages = []

    for (const token of tokens) {
      if (Expo.isExpoPushToken(token)) {
        messages.push({
          to: token,
          title: notification.title,
          sound: 'default',
          body: notification.message,
          data: notification.data ?? {},
        })
      }
    }

    if (messages.length === 0) return

    try {
      await this.#expoInstance.sendPushNotificationsAsync(messages)
    } catch (error) {
      notificationLog.error(
        'PUSH_SEND_ERROR',
        { recipientId: notification.recipientId },
        'Error sending Expo push to specific tokens'
      )
    }
  }
}
