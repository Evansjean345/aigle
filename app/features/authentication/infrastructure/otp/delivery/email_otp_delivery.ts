import { type OtpDeliveryStrategy } from '#features/authentication/domain/interfaces/otp_delivery_strategy'
import type OtpMessageTemplate from '#features/authentication/domain/interfaces/otp_message_template'
import SendMailJob from '#features/notifications/application/jobs/send_mail_job'
import { mailFromEmail } from '#config/mail'

export default class EmailOtpDelivery implements OtpDeliveryStrategy {
  readonly channel = 'email' as const

  /**
   * Sends an email with a provided OTP (One-Time Password) code using the specified email template.
   *
   * @param {string} email - The recipient's email address.
   * @param {string} code - The OTP code to include in the email.
   * @param {OtpMessageTemplate} template - The template object used to format the email content and subject.
   * @return {Promise<void>} A promise that resolves when the email dispatch is completed.
   */
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
