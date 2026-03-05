import OtpMessageTemplate from '#features/authentication/domain/interfaces/otp_message_template'

export default class DefaultOtpTemplate extends OtpMessageTemplate {
  readonly context = 'DEFAULT'

  formatSmsMessage(code: string): string {
    return `Votre code OTP AigleSend est ${code}. Il est valide pendant ${this.expirySeconds / 60} minutes.`
  }

  formatEmailSubject(): string {
    return 'Votre code de vérification AigleSend'
  }

  formatEmailViewData(code: string): Record<string, any> {
    return { code, expiresAt: this.expirySeconds / 60 }
  }
}
