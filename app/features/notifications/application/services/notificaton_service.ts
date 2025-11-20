import NotificationChannel from '#features/notifications/domain/interfaces/notification_channel'
import { Notification } from '#features/notifications/domain/notification'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { inject } from '@adonisjs/core'
import ExpoPushNotificationChannel from '#features/notifications/infrastructure/channels/expoPushNotificationChannel'

@inject()
export default class NotificationService {
  private channels: NotificationChannel[]

  /**
   * Constructor
   */
  constructor(private expoPushChannel: ExpoPushNotificationChannel) {
    this.channels = [this.expoPushChannel]
  }

  /**
   * Send notification to all channels
   *
   * @param notification
   */
  async send(notification: Notification) {
    for (const channel of this.channels) {
      await channel.send(notification)
    }
  }

  /**
   * Send notification via channel
   * @param channelName
   * @param notification
   */
  sendVia(channelName: NotificationChannelType, notification: Notification) {
    console.log('notification service send via')
    console.log(channelName)
    console.log(notification)

    const channel = this.channels.find((c) => c.name === channelName)
    if (!channel) throw new Error(`Channel ${channelName} not found`)
    return channel.send(notification)
  }
}
