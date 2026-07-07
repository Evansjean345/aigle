import { type OtpDeliveryStrategy } from '#core/identity/otp/domain/interfaces/otp_delivery_strategy'
import type OtpMessageTemplate from '#core/identity/otp/domain/templates/otp_message_template'
import SendMailJob from '#core/notifications/application/jobs/send_mail_job'
import { mailFromEmail } from '#config/mail'

export default class EmailOtpDelivery implements OtpDeliveryStrategy {
  readonly channel = 'email' as const

  async send(email: string, code: string, template: OtpMessageTemplate): Promise<void> {
    await SendMailJob.dispatch({
      to: email,
      from: mailFromEmail || 'no-reply@aiglesend.com',
      subject: template.formatEmailSubject(),
      htmlView: 'emails/otp_notification',
      viewData: template.formatEmailViewData(code),
    }).toQueue('mail')
  }
}
