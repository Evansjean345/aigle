import OtpMessageTemplate from '#core/otp/domain/templates/otp_message_template'

export default class AdminLoginOtpTemplate extends OtpMessageTemplate {
  readonly context = 'ADMIN_LOGIN'
  readonly expirySeconds = 300
  readonly maxAttempts = 5
  readonly resendDelaySeconds = 60

  formatEmailSubject(): string {
    return 'Code de connexion AigleSend'
  }

  formatEmailViewData(code: string): Record<string, any> {
    return { code, expiresAt: this.expirySeconds / 60 }
  }
}
