import { inject } from '@adonisjs/core'
import TransferQueryService from '#core/money/transfer/application/services/transfer_query_service'
import type { MassTransferBatchResult } from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * Liste les lots de décaissements d'une organisation.
 *
 * Filtrée sur `pending_approval', elle alimente la file d'approbation.
 */
@inject()
export default class ListMassTransfersUseCase {
  constructor(private readonly queryService: TransferQueryService) {}

  /**
   * Renvoie les lots de l'organisation.
   *
   * @param {string} organisationId - Organisation propriétaire des lots.
   * @param {string} [status] - Filtre optionnel sur le statut du lot.
   * @returns {Promise<MassTransferBatchResult[]>} Les lots correspondants.
   */
  execute(organisationId: string, status?: string): Promise<MassTransferBatchResult[]> {
    return this.queryService.listBatches(organisationId, status)
  }
}
