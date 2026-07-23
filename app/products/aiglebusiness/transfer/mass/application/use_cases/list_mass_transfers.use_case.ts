import { inject } from '@adonisjs/core'
import TransferQueryService from '#core/money/transfer/application/services/transfer_query_service'
import type { MassTransferBatchSummary } from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * Liste les lots de mass-transfer d'une organisation (B9), filtrable par statut. Account-centric :
 * la source est le compte org (`accountId = organisationId`). Alimente notamment la file
 * d'approbation (`?status=pending_approval`).
 */
@inject()
export default class ListMassTransfersUseCase {
  constructor(private readonly queryService: TransferQueryService) {}

  execute(organisationId: string, status?: string): Promise<MassTransferBatchSummary[]> {
    return this.queryService.listBatches(organisationId, status)
  }
}
