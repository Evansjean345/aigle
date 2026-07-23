import { inject } from '@adonisjs/core'
import TransferQueryService from '#core/money/transfer/application/services/transfer_query_service'
import TransferBatchNotFoundException from '#core/money/transfer/domain/exceptions/transfer_batch_not_found_exception'
import type { MassTransferBatchDetail } from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * Détail d'un lot de mass-transfer (batch + items) — B9. **Isolation par org** assurée dans le core
 * (le lot doit appartenir au compte) ; sinon `404` (on ne révèle pas l'existence d'un lot d'une
 * autre org).
 */
@inject()
export default class GetMassTransferUseCase {
  constructor(private readonly queryService: TransferQueryService) {}

  async execute(organisationId: string, reference: string): Promise<MassTransferBatchDetail> {
    const detail = await this.queryService.getBatchDetail(organisationId, reference)
    if (!detail) throw new TransferBatchNotFoundException()
    return detail
  }
}
