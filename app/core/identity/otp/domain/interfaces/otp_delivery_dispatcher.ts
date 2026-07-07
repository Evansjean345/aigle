import type OtpMessageTemplate from '#core/identity/otp/domain/templates/otp_message_template'

/**
 * Port de distribution d'OTP. L'application demande « délivre cet OTP vers cette
 * cible » ; l'infrastructure choisit la stratégie de canal (SMS, email, …) et
 * effectue l'envoi. L'application ne connaît aucune stratégie concrète.
 */
export default abstract class OtpDeliveryDispatcher {
  /**
   * Délivre le code OTP vers la cible (mobile → SMS, email → email).
   *
   * @param target Type de cible déduit de l'identifiant.
   * @param identifier Numéro de téléphone ou adresse email.
   * @param code Code OTP en clair à transmettre.
   * @param template Template de message fournissant le contenu.
   */
  abstract deliver(
    target: 'mobile' | 'email',
    identifier: string,
    code: string,
    template: OtpMessageTemplate
  ): Promise<void>
}
