import { Job } from '@adonisjs/queue'
import app from '@adonisjs/core/services/app'
import TransferItemProcessor from '#core/money/transfer/application/services/transfer_item_processor'
import errorLog from '#shared/infrastructure/logging/error_log'

export type ProcessTransferItemPayload = { itemId: number }

/**
 * Job d'exécution d'un item de mass-transfer (B4). **Wrapper mince** : toute la logique
 * (verrou, prefunded, retry/release) vit dans `TransferItemProcessor` (testable directement) ; le job
 * ne fait que résoudre le service et déléguer. Le **retry est piloté par l'item** (`next_retry_at`,
 * repris par le relais) — pas par le retry natif de la queue (L2-D11).
 */
export default class ProcessTransferItemJob extends Job<ProcessTransferItemPayload> {
  async execute(): Promise<void> {
    const processor = await app.container.make(TransferItemProcessor)
    await processor.process(this.payload.itemId)
  }

  async failed(error: Error): Promise<void> {
    errorLog.error(
      'PROCESS_TRANSFER_ITEM_JOB_FAILED',
      { itemId: this.payload?.itemId, error: error.message },
      'Process transfer item job failed'
    )
  }
}
