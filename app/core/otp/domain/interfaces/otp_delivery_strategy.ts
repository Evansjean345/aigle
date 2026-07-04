import type OtpMessageTemplate from '#core/otp/domain/templates/otp_message_template'

/**
 * Strategie d'envoi d'OTP.
 * Chaque canal (SMS, email, WhatsApp) implemente cette interface.
 */
export interface OtpDeliveryStrategy {
  readonly channel: 'sms' | 'email'

  send(identifier: string, code: string, template: OtpMessageTemplate): Promise<void>
}
