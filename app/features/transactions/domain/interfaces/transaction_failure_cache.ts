export default abstract class TransactionFailureCache {
  /**
   * Incrémente le compteur d'échecs pour un utilisateur
   */
  abstract incrementFailure(userId: string): Promise<void>

  /**
   * Vérifie si l'utilisateur est actuellement bloqué suite à trop d'échecs
   * @throws {TransactionBlockedException} si l'utilisateur est bloqué
   */
  abstract verifyNotBlocked(userId: string): Promise<void>

  /**
   * Réinitialise le compteur d'échecs (après un succès par exemple)
   */
  abstract resetFailures(userId: string): Promise<void>
}
