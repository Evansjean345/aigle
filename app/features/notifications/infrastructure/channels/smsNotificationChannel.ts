import NotificationChannel from '#features/notifications/domain/interfaces/notification_channel'
import { NotificationChannelType } from '#features/notifications/domain/notification_channel_type'
import { Notification } from '#features/notifications/domain/notification'
import env from '#start/env'
import appLog from '#shared/infrastructure/logging/app_log'

/**
 * SMS Notification Channel using MTarget API.
 * Sends SMS notifications to users via the MTarget SMS gateway.
 */
export default class SmsNotificationChannel implements NotificationChannel {
  name = NotificationChannelType.SMS

  private readonly apiUrl: string
  private readonly username: string
  private readonly password: string
  private readonly sender: string

  constructor() {
    this.apiUrl = env.get('MTARGET_URL')
    this.username = env.get('MTARGET_USERNAME')
    this.password = env.get('MTARGET_PASSWORD')
    this.sender = env.get('MTARGET_SENDER')
  }

  /**
   * Sends an SMS notification to the recipient.
   * The recipient's phone number should be set in notification.data.phone
   *
   * @param notification - The notification to send
   */
  async send(notification: Notification): Promise<void> {
    const phone = notification.data?.phone
    if (!phone) {
      appLog.error(
        'SMS_NO_PHONE_NUMBER',
        { recipientId: notification.recipientId },
        'No phone number provided for SMS notification'
      )
      return
    }

    await this.sendSms(notification.message, phone)
  }

  /**
   * Sends an SMS message to a specific phone number.
   *
   * @param message - The message content to send
   * @param phone - The recipient's phone number (should include country code, e.g., 2250700000000)
   */
  async sendSms(message: string, phone: string): Promise<any> {
    if (!phone || !message) {
      appLog.warn(
        'SMS_INVALID_PARAMS',
        { phone: phone ? '***' : 'missing', messageLength: message?.length || 0 },
        'Invalid parameters for SMS sending'
      )
      return
    }

    try {
      const data: Record<string, string> = {
        username: this.username,
        password: this.password,
        msisdn: `+${phone}`,
        sender: this.sender,
        msg: message,
        allowunicode: 'true',
      }

      const encodedData = new URLSearchParams(data).toString()

      console.log(encodedData)

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: encodedData,
      })

      const result = await response.text()

      appLog.info(
        'SMS_SENT',
        {
          phone: phone.replace(/\d(?=\d{2})/g, '*'),
          status: response.status,
          response: result,
        },
        'SMS request sent via MTarget'
      )

      return result
    } catch (error) {
      appLog.error(
        'SMS_SEND_ERROR',
        {
          phone: phone.replace(/\d(?=\d{2})/g, '*'),
          error: (error as Error)?.message || 'Unknown error',
        },
        'Error sending SMS via MTarget'
      )
      return error
    }
  }
}
