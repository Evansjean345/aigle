import redis from '@adonisjs/redis/services/main'
import ResetPasswordTokenProvider from '#core/authentication/domain/interfaces/reset_password_token_provider'

export default class RedisResetPasswordTokenProvider implements ResetPasswordTokenProvider {
  private prefix = 'auth:reset_token:'

  async store(phone: string, token: string, ttlSeconds: number): Promise<void> {
    const key = `${this.prefix}${phone}`
    await redis.set(key, token, 'EX', ttlSeconds)
  }

  async verify(phone: string, token: string): Promise<boolean> {
    const key = `${this.prefix}${phone}`
    const storedToken = await redis.get(key)
    return storedToken === token
  }

  async delete(phone: string): Promise<void> {
    const key = `${this.prefix}${phone}`
    await redis.del(key)
  }
}
