import OtpMessageTemplate from '#features/authentication/domain/interfaces/otp_message_template'

/**
 * Stratégie d'envoi d'OTP.
 * Chaque canal (SMS, email, WhatsApp) implémente cette interface.
 */
export interface OtpDeliveryStrategy {
  readonly channel: 'sms' | 'email'

  /**
   * Sends a message using the provided identifier, code, and template.
   *
   * @param {string} identifier - The identifier for the recipient (e.g., phone number or email address).
   * @param {string} code - The OTP (One-Time Password) or message content to be delivered.
   * @param {OtpMessageTemplate} template - The message template to format the OTP or message content.
   * @return {Promise<void>} A promise that resolves when the message is successfully sent.
   */
  send(identifier: string, code: string, template: OtpMessageTemplate): Promise<void>
}
