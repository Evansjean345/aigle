import NotificationChannel from '#features/notifications/domain/interfaces/notification_channel'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { inject } from '@adonisjs/core'
import ExpoPushNotificationChannel from '#features/notifications/infrastructure/channels/expoPushNotificationChannel'

@inject()
export default class NotificationService {
  /**
   * Represents a collection of notification channels.
   *
   * Each notification channel in the array is an instance of NotificationChannel,
   * which can represent a medium or method through which notifications are delivered,
   * such as email, SMS, or push notifications.
   */
  private readonly channels: NotificationChannel[]

  /**
   * Initializes a new instance of the class with the specified Expo Push Notification channel.
   *
   * @param {ExpoPushNotificationChannel} expoPushChannel - The Expo Push Notification channel to be used.
   */
  constructor(private expoPushChannel: ExpoPushNotificationChannel) {
    this.channels = [this.expoPushChannel]
  }

  /**
   * Sends a notification through all available channels.
   *
   * @param {Notification} notification - The notification object to be sent.
   */
  async send(notification: Notification): Promise<void> {
    for (const channel of this.channels) {
      await channel.send(notification)
    }
  }

  /**
   * Sends a notification through the specified channel.
   *
   * @param {NotificationChannelType} channelName - The name of the notification channel to send the notification through.
   * @param {Notification} notification - The notification object to be sent.
   * @return {void} Returns nothing if the notification is successfully sent.
   * @throws {Error} Throws an error if the specified channel is not found.
   */
  sendVia(channelName: NotificationChannelType, notification: Notification): Promise<void> {
    const channel = this.channels.find((c) => c.name === channelName)
    if (!channel) throw new Error(`Channel ${channelName} not found`)
    return channel.send(notification)
  }
}
