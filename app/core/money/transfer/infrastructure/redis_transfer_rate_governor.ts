import redis from '@adonisjs/redis/services/main'
import TransferRateGovernor from '#core/money/transfer/domain/interfaces/transfer_rate_governor'

/**
 * Token bucket Redis (voie batch, L2-D9). Un **seul** seau partagé par tous les workers (une IP de
 * sortie = un budget) → clé fixe. Rechargé à `REFILL`/s, plafonné à `CAPACITY`. L'acquisition est
 * **atomique** via un script Lua (lecture tokens+horodatage → recharge → prélèvement → écriture en
 * une passe), donc sans course entre workers.
 *
 * Réf. Hub2 : `POST /transfers` = 75/10 s ≈ 7,5/s par IP → on vise ~7/s avec marge.
 */
export default class RedisTransferRateGovernor extends TransferRateGovernor {
  private static readonly KEY = 'transfer:egress:batch'
  private static readonly CAPACITY = 7
  private static readonly REFILL_PER_SEC = 7

  private readonly connection = redis.connection('limiter')

  /**
   * KEYS[1] = seau ; ARGV = capacity, refillPerSec, nowMs, requested.
   * Recharge proportionnelle au temps écoulé, prélève min(dispo, demandé), persiste, TTL de sécurité.
   */
  private static readonly SCRIPT = `
    local capacity = tonumber(ARGV[1])
    local rate = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local requested = tonumber(ARGV[4])
    local data = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
    local tokens = tonumber(data[1])
    local ts = tonumber(data[2])
    if tokens == nil then tokens = capacity; ts = now end
    local elapsed = math.max(0, now - ts) / 1000.0
    tokens = math.min(capacity, tokens + elapsed * rate)
    local granted = math.min(tokens, requested)
    tokens = tokens - granted
    redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', now)
    redis.call('PEXPIRE', KEYS[1], 60000)
    return math.floor(granted)
  `

  async tryAcquire(max: number): Promise<number> {
    if (max <= 0) return 0

    const granted = await this.connection.eval(
      RedisTransferRateGovernor.SCRIPT,
      1,
      RedisTransferRateGovernor.KEY,
      String(RedisTransferRateGovernor.CAPACITY),
      String(RedisTransferRateGovernor.REFILL_PER_SEC),
      String(Date.now()),
      String(max)
    )

    return Number(granted)
  }
}
