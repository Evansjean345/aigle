import redis from '@adonisjs/redis/services/main'
import TimedFlag from '#shared/domain/cache/timed_flag'

export default class RedisTimedFlag extends TimedFlag {
  private readonly connection = redis.connection('limiter')

  async set(key: string, ttlSeconds: number): Promise<void> {
    await this.connection.set(key, '1', 'EX', ttlSeconds)
  }

  async ttl(key: string): Promise<number> {
    const remaining = await this.connection.ttl(key)
    return remaining > 0 ? remaining : 0
  }

  async clear(key: string): Promise<void> {
    await this.connection.del(key)
  }
}
