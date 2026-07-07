import { OtpDeliveryStrategy } from '#core/identity/otp/domain/interfaces/otp_delivery_strategy'
import OtpMessageTemplate from '#core/identity/otp/domain/templates/otp_message_template'
import NotificationService from '#core/notifications/application/services/notification_service'
import { inject } from '@adonisjs/core'
import { appEnv } from '#config/app'

@inject()
export default class SmsOtpDelivery implements OtpDeliveryStrategy {
  readonly channel = 'sms' as const

  constructor(private readonly notificationService: NotificationService) {}

  async send(phone: string, code: string, template: OtpMessageTemplate): Promise<void> {
    const message = template.formatSmsMessage(code)

    if (appEnv === 'development') {
      console.log(message)
      return
    }

    await this.notificationService.sendSms(message, phone)
  }
}
