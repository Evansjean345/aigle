import OtpMessageTemplate from '#features/otp/domain/templates/otp_message_template'

export default class AdminSetupOtpTemplate extends OtpMessageTemplate {
  readonly context = 'ADMIN_SETUP'
  readonly expirySeconds = 900

  formatSmsMessage(code: string): string {
    return `Votre code de configuration admin est ${code}.`
  }

  formatEmailSubject(): string {
    return 'Configuration de votre compte administrateur AigleSend'
  }

  formatEmailViewData(code: string): Record<string, any> {
    return { code, expiresAt: this.expirySeconds / 60 }
  }
}
