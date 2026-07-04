import NotificationChannel from '#core/notifications/domain/interfaces/notification_channel'
import { Notification } from '#core/notifications/domain/notification'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import { inject } from '@adonisjs/core'
import ExpoPushNotificationChannel from '#core/notifications/infrastructure/channels/expo_push_notification_channel'
import Sms_notification_channel from '#core/notifications/infrastructure/channels/sms_notification_channel'
import EmailNotificationChannel from '#core/notifications/infrastructure/channels/email_notification_channel'

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
   * Initializes a new instance of the class with the specified notification channels.
   *
   * @param {ExpoPushNotificationChannel} expoPushChannel - The Expo Push Notification channel to be used.
   * @param {Sms_notification_channel} smsChannel - The SMS notification channel to be used.
   * @param {EmailNotificationChannel} emailChannel - The Email notification channel to be used.
   */
  constructor(
    private expoPushChannel: ExpoPushNotificationChannel,
    private smsChannel: Sms_notification_channel,
    private emailChannel: EmailNotificationChannel
  ) {
    this.channels = [this.expoPushChannel, this.smsChannel, this.emailChannel]
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

  /**
   * Sends a push notification to specific push tokens.
   *
   * @param {string[]} tokens - Array of push tokens to send the notification to.
   * @param {Notification} notification - The notification object to be sent.
   * @return {Promise<void>} Returns a promise that resolves when the notification is sent.
   */
  async sendPushToTokens(tokens: string[], notification: Notification): Promise<void> {
    return this.expoPushChannel.sendToTokens(tokens, notification)
  }

  /**
   * Sends an SMS message to a specific phone number.
   *
   * @param {string} message - The message content to send.
   * @param {string} phone - The recipient's phone number.
   * @return {Promise<void>} Returns a promise that resolves when the SMS is sent.
   */
  async sendSms(message: string, phone: string): Promise<void> {
    return this.smsChannel.sendSms(message, phone)
  }
}
