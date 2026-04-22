/**
 * Boolean flag with a TTL. `set` arms the flag for `ttlSeconds`; `ttl`
 * returns the remaining seconds (0 if unset or expired). Used for
 * temporary blocks, cooldowns, and other time-bound signals.
 */
export default abstract class TimedFlag {
  abstract set(key: string, ttlSeconds: number): Promise<void>
  abstract ttl(key: string): Promise<number>
  abstract clear(key: string): Promise<void>
}
