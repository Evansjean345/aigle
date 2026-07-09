import OtpMessageTemplate from '#core/identity/otp/domain/templates/otp_message_template'

/**
 * OTP de connexion au portail/app business (2e facteur après le PIN). Envoyé à
 * chaque login (décision #9 : pas de skip, appli financière).
 */
export default class BusinessLoginOtpTemplate extends OtpMessageTemplate {
  readonly context = 'BUSINESS_LOGIN'

  formatSmsMessage(code: string): string {
    return (
      `Votre code de connexion AigleBusiness : ${code}. ` +
      `Il expire dans ${this.expirySeconds / 60} minutes. ` +
      'Ne le partagez à personne.'
    )
  }
}
