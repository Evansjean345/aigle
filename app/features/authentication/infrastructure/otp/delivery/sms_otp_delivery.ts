import { OtpDeliveryStrategy } from '#features/authentication/domain/interfaces/otp_delivery_strategy'
import OtpMessageTemplate from '#features/authentication/domain/interfaces/otp_message_template'
import NotificationService from '#features/notifications/application/services/notificaton_service'
import { inject } from '@adonisjs/core'
import { appEnv } from '#config/app'

@inject()
export default class SmsOtpDelivery implements OtpDeliveryStrategy {
  readonly channel = 'sms' as const

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Sends an SMS message containing a code using the specified template.
   *
   * @param {string} phone - The recipient's phone number.
   * @param {string} code - The code to be included in the SMS message.
   * @param {OtpMessageTemplate} template - The template to format the SMS message.
   * @return {Promise<void>} A promise that resolves when the SMS message is sent successfully.
   */
  async send(phone: string, code: string, template: OtpMessageTemplate): Promise<void> {
    const message = template.formatSmsMessage(code)

    if (appEnv === 'development') {
      console.log(message)
      return
    }

    await this.notificationService.sendSms(message, phone)
  }
}
