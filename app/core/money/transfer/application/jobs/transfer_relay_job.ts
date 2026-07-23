import { Job } from '@adonisjs/queue'
import app from '@adonisjs/core/services/app'
import TransferRelayService from '#core/money/transfer/application/services/transfer_relay_service'

/** Cadence du relais (auto-replanification, L2-D10) — pas de scheduler externe à installer. */
const RELAY_TICK_DELAY = '2s'

/**
 * Job de cadence du relais (B4b). **Wrapper mince** : un tick via `TransferRelayService`, puis
 * **auto-replanification** tant qu'il reste du travail — soit des items dispatchés (progrès), soit un
 * throttle (budget épuisé → on repasse quand le seau se recharge). S'arrête quand un tick trouve la
 * file vide **avec** du budget (idle) ; un nouvel `approve` (B8) relance le relais.
 */
export default class TransferRelayJob extends Job<Record<string, never>> {
  async execute(): Promise<void> {
    const relay = await app.container.make(TransferRelayService)
    const { dispatched, throttled } = await relay.tick()

    if (dispatched > 0 || throttled) {
      await TransferRelayJob.dispatch({}).in(RELAY_TICK_DELAY)
    }
  }
}
