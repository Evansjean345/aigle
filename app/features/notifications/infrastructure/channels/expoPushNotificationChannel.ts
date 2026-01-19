import NotificationChannel from '#features/notifications/domain/interfaces/notification_channel'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { Expo } from 'expo-server-sdk'
import DeviceRepository from '#features/device/domain/interfaces/device_repository'
import { Exception } from '@adonisjs/core/exceptions'
import { Notification } from '#features/notifications/domain/notification'
import { inject } from '@adonisjs/core'

@inject()
export default class ExpoPushNotificationChannel implements NotificationChannel {
  name = NotificationChannelType.PushNotification
  #expoInstance: Expo

  /**
   * Creates an instance of the class and initializes necessary dependencies and properties.
   *
   * @param {DeviceRepository} deviceRepository - The repository instance for managing device data.
   */
  constructor(private deviceRepository: DeviceRepository) {
    this.#expoInstance = new Expo()
  }

  /**
   * Send notification to expo push notification channel
   * @param notification
   */
  async send(notification: Notification): Promise<void> {
    const devices = await this.deviceRepository.getDevicesByUserId(notification.recipientId)

    if (devices.length === 0) return
    const tokens = devices.map((d) => d.token)

    if (!tokens || tokens.length === 0) {
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
}
