import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'
import { type InferConnections } from '@adonisjs/redis/types'

const redisConfig = defineConfig({
  connection: 'main',

  connections: {
    /*
    |--------------------------------------------------------------------------
    | The default connection (db: 0)
    |--------------------------------------------------------------------------
    |
    | The main connection you want to use to execute redis commands. The same
    | connection will be used by the session provider, if you rely on the
    | redis driver.
    |
    */
    main: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 0,
      keyPrefix: '',
      retryStrategy(times) {
        return times > 10 ? null : times * 50
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Queue connection (db: 1)
    |--------------------------------------------------------------------------
    |
    | Dedicated database for background jobs and queues.
    | Isolated so a FLUSHDB here only affects pending/completed jobs.
    |
    */
    queue: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 1,
      keyPrefix: '',
      retryStrategy(times) {
        return times > 10 ? null : times * 50
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Cache connection (db: 2)
    |--------------------------------------------------------------------------
    |
    | Dedicated database for application cache (L2 layer + bus).
    | Ephemeral data — safe to flush without side effects.
    |
    */
    cache: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 2,
      keyPrefix: '',
      retryStrategy(times) {
        return times > 10 ? null : times * 50
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Limiter connection (db: 3)
    |--------------------------------------------------------------------------
    |
    | Dedicated database for rate limiting counters.
    | Separated from cache to prevent accidental resets of rate limits.
    |
    */
    limiter: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 3,
      keyPrefix: '',
      retryStrategy(times) {
        return times > 10 ? null : times * 50
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Transactions connection (db: 4)
    |--------------------------------------------------------------------------
    |
    | Dedicated database for critical transaction data:
    | idempotency keys, throttle, volume tracking, failure counters.
    | Maximum isolation for fintech-sensitive data.
    |
    */
    transactions: {
      host: env.get('REDIS_HOST'),
      port: env.get('REDIS_PORT'),
      password: env.get('REDIS_PASSWORD', ''),
      db: 4,
      keyPrefix: '',
      retryStrategy(times) {
        return times > 10 ? null : times * 50
      },
    },
  },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
  export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
