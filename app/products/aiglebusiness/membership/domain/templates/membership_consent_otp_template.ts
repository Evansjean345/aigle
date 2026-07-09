import OtpMessageTemplate from '#core/identity/otp/domain/templates/otp_message_template'

/**
 * OTP de consentement à l'ajout comme membre d'une organisation (Lot B).
 * Envoyé au téléphone de l'invité à l'ouverture du lien d'invitation ; sa saisie
 * vaut consentement (2e facteur après le token du lien).
 */
export default class MembershipConsentOtpTemplate extends OtpMessageTemplate {
  readonly context = 'ORG_MEMBER_CONSENT'

  /**
   * @param organisationName Nom de l'organisation, rendu dans le SMS d'envoi. Optionnel car
   *   la vérification (accept) n'utilise que le contexte du template, jamais le message.
   */
  constructor(private readonly organisationName?: string) {
    super()
  }

  formatSmsMessage(code: string): string {
    return (
      `Votre code d'adhésion à ${this.organisationName} est : ${code}, ` +
      `ce code expire dans ${this.expirySeconds / 60} minutes. ` +
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message. " +
      'Ce code est strictement confidentiel, ne le partagez à personne.'
    )
  }
}
