export default abstract class TransactionFailureCache {
  /**
   * Incrémente le compteur d'échecs pour un utilisateur
   */
  abstract incrementFailure(userId: string): Promise<void>

  /**
   * Verifies whether the specified user is not blocked.
   *
   * @param userId The unique identifier of the user to check.
   * @return A promise that resolves if the user is not blocked, or rejects if the user is blocked.
   */
  abstract verifyNotBlocked(userId: string): Promise<void>

  /**
   * Réinitialise le compteur d'échecs (après un succès par exemple)
   */
  abstract resetFailures(userId: string): Promise<void>
}
