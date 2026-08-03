import type SmsNotificationChannel from '#core/notifications/domain/interfaces/sms_notification_channel'
import { NotificationChannelType } from '#core/notifications/domain/notification_channel_type'
import { type Notification } from '#core/notifications/domain/notification'
import env from '#start/env'
import { appEnv } from '#config/app'
import notificationLog from '#shared/infrastructure/logging/notification_log'
import errorLog from '#shared/infrastructure/logging/error_log'
import { maskPhone } from '#shared/utils/utiles'

/**
 * SMS Notification Channel using MTarget API.
 * Sends SMS notifications to users via the MTarget SMS gateway.
 */
export default class SmsNotificationChannelImpl implements SmsNotificationChannel {
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
      notificationLog.error(
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
      notificationLog.warn(
        'SMS_INVALID_PARAMS',
        { phone: phone ? '***' : 'missing', messageLength: message?.length || 0 },
        'Invalid parameters for SMS sending'
      )
      return
    }

    // En développement, on n'appelle pas la passerelle MTarget : on affiche le SMS en
    // console (comme les OTP, cf. SmsOtpDelivery) pour éviter les envois réels et les coûts.
    if (appEnv === 'development') {
      console.log(`[SMS dev] → +${phone}\n${message}`)
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

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: encodedData,
      })

      const result = await response.text()

      notificationLog.info(
        'SMS_SENT',
        {
          phone: maskPhone(phone),
          status: response.status,
          response: result,
        },
        'SMS request sent via MTarget'
      )

      return result
    } catch (error) {
      errorLog.error(
        'SMS_SEND_ERROR',
        {
          phone: maskPhone(phone),
          error: (error as Error)?.message || 'Unknown error',
        },
        'Error sending SMS via MTarget'
      )
      return error
    }
  }
}
