import OtpMessageTemplate from '#features/authentication/domain/interfaces/otp_message_template'

export default class DebitPhoneOtpTemplate extends OtpMessageTemplate {
  readonly context = 'DEBIT_PHONE'

  formatSmsMessage(code: string): string {
    return (
      "Une demande d'enregistrement de votre numéro comme numéro de rechargement " +
      `d'un compte Aigle Send a été initiée. Confirmez en saisissant le code ${code}. ` +
      `Ce code expire dans ${this.expirySeconds / 60} minutes. ` +
      'Si cette action ne vient pas de vous, ignorer ce message. ' +
      'Ce code est strictement confidentiel, ne le partagez à personne.'
    )
  }
}
