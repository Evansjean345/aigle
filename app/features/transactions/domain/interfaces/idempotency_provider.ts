export default abstract class IdempotencyProvider {
  /**
   * Tente de marquer une clé (ex: X-Idempotency-Key) comme traitée.
   * @param key La clé d'idempotence unique.
   * @param ttlSeconds Durée de validité de la clé dans le cache (défaut 24h).
   * @returns true si la clé est nouvelle, false si elle a déjà été traitée.
   */
  abstract checkAndMark(key: string, ttlSeconds?: number): Promise<boolean>
}
