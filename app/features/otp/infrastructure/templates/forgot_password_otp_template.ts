import OtpMessageTemplate from '#features/otp/domain/templates/otp_message_template'

export default class ForgotPasswordOtpTemplate extends OtpMessageTemplate {
  readonly context = 'FORGOT_PASSWORD'
  readonly expirySeconds = 300
  readonly maxAttempts = 3
  readonly resendDelaySeconds = 120

  formatSmsMessage(code: string): string {
    return (
      `Votre code de réinitialisation de mot de passe AigleSend est ${code}. ` +
      `Il expire dans ${this.expirySeconds / 60} minutes. ` +
      'Ne partagez jamais ce code.'
    )
  }
}
