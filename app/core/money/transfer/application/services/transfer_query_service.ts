import { inject } from '@adonisjs/core'
import TransferBatchRepository from '#core/money/transfer/domain/interfaces/transfer_batch_repository'
import TransferItemRepository from '#core/money/transfer/domain/interfaces/transfer_item_repository'
import {
  MassTransferBatchDetailResult,
  MassTransferBatchResult,
} from '#core/money/transfer/application/dtos/transfer.dto'
import {
  MassTransferAdminBatchResult,
  MassTransferAdminBatchDetailResult,
} from '#core/money/transfer/application/dtos/admin/admin_transfer.dto'

/**
 * Lecture des lots de mass-transfer. Retourne des DTO plats, aucun modèle Lucid n'étant exposé au
 * produit.
 *
 * Isolation par organisation : le détail par référence n'est renvoyé que si le lot appartient au
 * compte, sauf sur les lectures admin, qui traverse volontairement les organisations.
 *
 * Les lectures client renvoient les vues de `transfer.dto.ts`, les lectures admin celles de
 * `admin/admin_transfer.dto.ts`. Le mapping appartient aux DTOs.
 */
@inject()
export default class TransferQueryService {
  constructor(
    private readonly batchRepo: TransferBatchRepository,
    private readonly itemRepo: TransferItemRepository
  ) {}

  async listBatches(accountId: string, status?: string): Promise<MassTransferBatchResult[]> {
    const batches = await this.batchRepo.listByAccount(accountId, status)
    return batches.map((batch) => MassTransferBatchResult.fromBatch(batch))
  }

  async getBatchDetail(
    accountId: string,
    reference: string
  ): Promise<MassTransferBatchDetailResult | null> {
    const batch = await this.batchRepo.findByReference(reference)
    if (!batch || batch.accountId !== accountId) return null // isolation par org

    const items = await this.itemRepo.listByBatch(batch.id)
    return MassTransferBatchDetailResult.fromBatchWithItems(batch, items)
  }

  /**
   * Liste les lots pour l'espace admin, tous comptes confondus.
   *
   * ⚠️ **Aucun cloisonnement par compte**, contrairement à `listBatches` : à réserver aux
   * contrôleurs admin.
   *
   * @param {string} [status] - Filtre optionnel sur le statut du lot.
   * @param {string} [accountId] - Restreint à un compte, pour la vue par organisation.
   * @returns {Promise<MassTransferAdminBatchResult[]>} Les lots correspondants.
   */
  async listForAdmin(status?: string, accountId?: string): Promise<MassTransferAdminBatchResult[]> {
    const batches = await this.batchRepo.listForAdmin(status, accountId)
    return batches.map((batch) => MassTransferAdminBatchResult.fromBatch(batch))
  }

  /**
   * Détail d'un lot pour l'espace admin, sans vérifier le compte propriétaire.
   *
   * ⚠️ À réserver aux contrôleurs admin : un membre passant par ici lirait le lot d'une autre
   * organisation.
   *
   * @param {string} reference - Référence du lot.
   * @returns {Promise<MassTransferAdminBatchDetailResult | null>} Le lot et ses bénéficiaires, ou
   * `null` si la référence est inconnue.
   */
  async getBatchDetailForAdmin(
    reference: string
  ): Promise<MassTransferAdminBatchDetailResult | null> {
    const batch = await this.batchRepo.findByReference(reference)
    if (!batch) return null

    const items = await this.itemRepo.listByBatch(batch.id)
    return MassTransferAdminBatchDetailResult.fromBatchWithItems(batch, items)
  }
}
