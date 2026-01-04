import redis from '@adonisjs/redis/services/main'
import IdempotencyProvider from '#features/transactions/domain/interfaces/idempotency_provider'

export default class RedisIdempotencyProvider implements IdempotencyProvider {
  /**
   * Tente de marquer une clé (ex: X-Idempotency-Key) comme traitée.
   * @param key La clé d'idempotence unique.
   * @param ttlSeconds Durée de validité de la clé dans le cache (défaut 24h : 86400s).
   * @returns true si la clé est nouvelle, false si elle a déjà été traitée.
   */
  async checkAndMark(key: string, ttlSeconds: number = 86400): Promise<boolean> {
    const redisKey = `tx:idempotency:${key}`
    const res = await redis.set(redisKey, '1', 'EX', ttlSeconds, 'NX')
    return res === 'OK'
  }
}
