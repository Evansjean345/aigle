import redis from '@adonisjs/redis/services/main'
import SlidingWindowCounter from '#shared/domain/cache/sliding_window_counter'

export default class RedisSlidingWindowCounter extends SlidingWindowCounter {
  private readonly connection = redis.connection('limiter')

  async increment(key: string, windowSeconds: number): Promise<number> {
    const count = await this.connection.incr(key)
    await this.connection.expire(key, windowSeconds)
    return count
  }

  async reset(key: string): Promise<void> {
    await this.connection.del(key)
  }
}
