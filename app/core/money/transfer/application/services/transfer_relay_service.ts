import { inject } from '@adonisjs/core'
import TransferRateGovernor from '#core/money/transfer/domain/interfaces/transfer_rate_governor'
import TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import ProcessTransferItemJob from '#core/money/transfer/application/jobs/process_transfer_item_job'

/** Borne max d'items dispatchés par tick (le token bucket borne le **débit réel**, plus bas). */
const RELAY_BATCH_SIZE = 20

/**
 * Relais d'exécution du mass-transfer (B4b, L2-D9/D10) — **point unique de cadence**. Un tick :
 * 1. acquiert des tokens de la voie **batch** (gouverneur) → n'en demande jamais plus que `BATCH_SIZE` ;
 * 2. tire les items **dus** (lot en drain, item `queued` frais ou retry échu), plafonné aux tokens ;
 * 3. dispatch un `ProcessTransferItemJob` par item (le verrou `lockForSending` garantit l'unicité).
 *
 * Le relais ne relâche que ce que le budget permet → jamais de matraquage de Hub2 (zéro 429). La
 * boucle de cadence (auto-replanification) vit dans `TransferRelayJob`.
 */
@inject()
export default class TransferRelayService {
  constructor(
    private readonly governor: TransferRateGovernor,
    private readonly itemRepo: TransferItemRepository
  ) {}

  async tick(): Promise<{ dispatched: number; throttled: boolean }> {
    const tokens = await this.governor.tryAcquire(RELAY_BATCH_SIZE)
    if (tokens <= 0) return { dispatched: 0, throttled: true }

    const itemIds = await this.itemRepo.selectDueItemIds(tokens)
    for (const itemId of itemIds) {
      await ProcessTransferItemJob.dispatch({ itemId })
    }

    return { dispatched: itemIds.length, throttled: false }
  }
}
