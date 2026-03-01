/**
 * Représente un template de message OTP.
 * Chaque contexte d'envoi d'OTP (register, login, debit phone, etc.)
 * implémente cette interface pour définir son propre message.
 */
export default abstract class OtpMessageTemplate {
  /** Code identifiant le contexte (pour les logs) */
  abstract readonly context: string

  /** Durée de validité en secondes (permet de varier par contexte) */
  readonly expirySeconds: number = 600

  /** Nombre max de tentatives de vérification */
  readonly maxAttempts: number = 5

  /** Délai minimum entre deux envois (en secondes) */
  readonly resendDelaySeconds: number = 60

  /** Génère le message SMS à envoyer */
  formatSmsMessage(code: string): string {
    return `Votre code OTP Aiglesend : ${code}`
  }

  /** Génère le sujet de l'email (si applicable) */
  formatEmailSubject(): string {
    return 'Code OTP Aiglesend'
  }

  /** Données supplémentaires pour le template email (si applicable) */
  formatEmailViewData(code: string): Record<string, any> {
    return {
      code,
    }
  }
}
