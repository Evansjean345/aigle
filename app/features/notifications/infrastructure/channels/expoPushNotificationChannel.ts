import NotificationChannel from '#features/notifications/domain/interfaces/notification_channel'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { Expo } from 'expo-server-sdk'
import { Notification } from '#features/notifications/domain/notification'
import { inject } from '@adonisjs/core'
import { Exception } from '@adonisjs/core/exceptions'
import DeviceService from '#features/device/application/services/device_service'
import appLog from '#shared/infrastructure/logging/app_log'

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
   * Send notification to expo push notification channel
   * @param notification
   */
  async send(notification: Notification): Promise<void> {
    const devices = await this.deviceService.getTrustedDevices(notification.recipientId)

    if (devices.length === 0) return
    const tokens = devices.map((d) => d.pushToken)

    if (!tokens || tokens.length === 0) {
      appLog.error(
        'NO_PUSH_TOKENS_FOUND',
        {},
        'No push tokens found for user: ' + notification.recipientId + ''
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

      console.log(JSON.stringify(messages, null, 2))
    }

    if (messages.length === 0) return

    try {
      await this.#expoInstance.sendPushNotificationsAsync(messages)
    } catch (error) {
      console.error('Error sending Expo push:', error)
    }
  }

  /**
   * Send notification to specific push tokens
   * @param tokens - Array of push tokens to send the notification to
   * @param notification - The notification to send
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
      console.error('Error sending Expo push to specific tokens:', error)
    }
  }
}
