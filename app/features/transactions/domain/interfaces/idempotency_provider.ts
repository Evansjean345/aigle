export default abstract class IdempotencyProvider {
  /**
   * Tente de marquer une clé (ex: X-Idempotency-Key) comme traitée.
   * @param key La clé d'idempotence unique.
   * @param ttlSeconds Durée de validité de la clé dans le cache (défaut 24h).
   * @returns true si la clé est nouvelle, false si elle a déjà été traitée.
   */
  abstract checkAndMark(key: string, ttlSeconds?: number): Promise<boolean>

  /**
   * Récupère la valeur associée à une clé d'idempotence.
   * @param key La clé d'idempotence unique.
   */
  abstract get(key: string): Promise<string | null>

  /**
   * Met à jour la valeur associée à une clé d'idempotence.
   * @param key La clé d'idempotence unique.
   * @param value La nouvelle valeur (ex: UID de la transaction).
   * @param ttlSeconds Durée de validité.
   */
  abstract update(key: string, value: string, ttlSeconds?: number): Promise<void>

  /**
   * Supprime une clé d'idempotence. Utilisé pour libérer une clé orpheline
   * après l'échec d'un use case, afin de permettre un retry propre.
   * @param key La clé d'idempotence unique.
   */
  abstract delete(key: string): Promise<void>
}
