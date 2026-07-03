import type { ApplicationService } from '@adonisjs/core/types'

import TransactionThrottleCache from '#features/risk/domain/interfaces/transaction_throttle_cache'
import RedisTransactionThrottleCache from '#features/risk/infrastructure/redis_transaction_throttle_cache'
import TransactionFailureCache from '#features/risk/domain/interfaces/transaction_failure_cache'
import RedisTransactionFailureCache from '#features/risk/infrastructure/redis_transaction_failure_cache'

/**
 * Wiring de la feature `risk` (anti-abus / risque opérationnel).
 *
 * Binde les contrats d'anti-abus (vélocité + blocage) sur leurs implémentations Redis. Ces caches
 * étaient dans `transactions` (money-core) ; ils appartiennent au risque, pas à l'argent
 * (cf. ADR-0014). Le côté écriture (mise à jour des compteurs) est event-driven (listeners `risk`
 * abonnés aux events de cycle de vie transaction) ; le côté lecture (gardes) est une query
 * synchrone consommée par le produit / la future façade IdentityGate.
 */
export default class RiskProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    const providers = new Map<any, any>([
      [TransactionThrottleCache, RedisTransactionThrottleCache],
      [TransactionFailureCache, RedisTransactionFailureCache],
    ])

    for (const [contract, implementation] of providers) {
      this.app.container.singleton(contract, () => {
        return new implementation()
      })
    }
  }
}
