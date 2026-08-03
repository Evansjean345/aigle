import { inject } from '@adonisjs/core'
import TransferQueryService from '#core/money/transfer/application/services/transfer_query_service'
import TransferBatchNotFoundException from '#core/money/transfer/domain/exceptions/transfer_batch_not_found_exception'
import type { MassTransferBatchDetailResult } from '#core/money/transfer/application/dtos/transfer.dto'

/**
 * Détail d'un lot de décaissements et de ses bénéficiaires.
 *
 * Un lot appartenant à une autre organisation est traité comme introuvable, pour ne pas révéler son
 * existence.
 */
@inject()
export default class GetMassTransferUseCase {
  constructor(private readonly queryService: TransferQueryService) {}

  /**
   * Renvoie le détail du lot.
   *
   * @param {string} organisationId - Organisation propriétaire du lot.
   * @param {string} reference - Référence du lot.
   * @returns {Promise<MassTransferBatchDetailResult>} Le lot et ses bénéficiaires.
   * @throws {TransferBatchNotFoundException} Référence inconnue, ou lot d'une autre organisation.
   */
  async execute(organisationId: string, reference: string): Promise<MassTransferBatchDetailResult> {
    const detail = await this.queryService.getBatchDetail(organisationId, reference)
    if (!detail) throw new TransferBatchNotFoundException()
    return detail
  }
}
