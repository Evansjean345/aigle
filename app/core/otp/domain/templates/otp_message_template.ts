/**
 * Represente un template de message OTP.
 * Chaque contexte d'envoi d'OTP (register, login, debit phone, etc.)
 * implemente cette interface pour definir son propre message.
 */
export default abstract class OtpMessageTemplate {
  /** Code identifiant le contexte (pour les logs) */
  abstract readonly context: string

  /** Duree de validite en secondes (permet de varier par contexte) */
  readonly expirySeconds: number = 600

  /** Nombre max de tentatives de verification */
  readonly maxAttempts: number = 5

  /** Delai minimum entre deux envois (en secondes) */
  readonly resendDelaySeconds: number = 60

  /** Genere le message SMS a envoyer */
  formatSmsMessage(code: string): string {
    return `Votre code OTP Aiglesend : ${code}`
  }

  /** Genere le sujet de l'email (si applicable) */
  formatEmailSubject(): string {
    return 'Code OTP Aiglesend'
  }

  /** Donnees supplementaires pour le template email (si applicable) */
  formatEmailViewData(code: string): Record<string, any> {
    return {
      code,
    }
  }
}
