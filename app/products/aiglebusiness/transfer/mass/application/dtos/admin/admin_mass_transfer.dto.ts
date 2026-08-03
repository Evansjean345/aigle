import type { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'
import type {
  MassTransferAdminBatchResult,
  MassTransferAdminBatchDetailResult,
  MassTransferAdminItemResult,
} from '#core/money/transfer/application/dtos/admin/admin_transfer.dto'

/**
 * Contrats admin du paiement en masse.
 *
 * Bâtis sur les vues admin du core, jamais sur le contrat client : les deux canaux restent
 * indépendants.
 *
 * Lecture seule : aucune action n'est exposée à l'admin, l'approbation restant un contrôle interne à
 * l'organisation.
 */

// ── Result (output service) ─────────────────────────────────────────

/** Acteur ou organisation, avec son nom résolu. `name` est `null` s'il n'a pas été trouvé. */
export interface MassTransferActorRef {
  id: string
  name: string | null
}

/** Tables de noms résolues pour un lot de batches, indexées par identifiant. */
export interface MassTransferActorNamesResult {
  members: Map<string, string>
  organisations: Map<string, string>
}

// ── Response (output HTTP) ──────────────────────────────────────────

/** Lot tel que le voit le back-office : la vue admin du core plus les noms résolus. */
export class MassTransferAdminResponseDTO {
  declare reference: string
  declare accountId: string
  declare label: string | null
  declare status: TransferBatchStatus
  declare totalAmount: number
  declare fees: number
  declare expectedCount: number
  declare successfulCount: number
  declare failedCount: number
  declare initiatedBy: string
  declare approvedBy: string | null
  declare createdAt: string | null
  declare organisation: MassTransferActorRef
  declare initiatedByActor: MassTransferActorRef
  declare approvedByActor: MassTransferActorRef | null

  /**
   * Construit la vue admin d'un lot en y injectant les noms résolus.
   *
   * @param {MassTransferAdminBatchResult} batch - Vue admin produite par le core.
   * @param {MassTransferActorNamesResult} names - Noms résolus pour l'ensemble du lot.
   * @returns {MassTransferAdminResponseDTO} La vue destinée au back-office.
   */
  static fromAdminBatchResult(
    batch: MassTransferAdminBatchResult,
    names: MassTransferActorNamesResult
  ): MassTransferAdminResponseDTO {
    const dto = Object.assign(new MassTransferAdminResponseDTO(), batch)

    dto.organisation = {
      id: batch.accountId,
      name: names.organisations.get(batch.accountId) ?? null,
    }
    dto.initiatedByActor = {
      id: batch.initiatedBy,
      name: names.members.get(batch.initiatedBy) ?? null,
    }
    dto.approvedByActor =
      batch.approvedBy === null
        ? null
        : { id: batch.approvedBy, name: names.members.get(batch.approvedBy) ?? null }

    return dto
  }
}

/** Détail d'un lot : la vue admin plus ses bénéficiaires. */
export class MassTransferAdminDetailResponseDTO extends MassTransferAdminResponseDTO {
  declare items: MassTransferAdminItemResult[]

  /**
   * Construit la vue admin détaillée d'un lot, bénéficiaires inclus.
   *
   * @param {MassTransferAdminBatchDetailResult} detail - Détail admin produit par le core.
   * @param {MassTransferActorNamesResult} names - Noms résolus.
   * @returns {MassTransferAdminDetailResponseDTO} La vue détaillée.
   */
  static fromAdminBatchDetailResult(
    detail: MassTransferAdminBatchDetailResult,
    names: MassTransferActorNamesResult
  ): MassTransferAdminDetailResponseDTO {
    const dto = Object.assign(
      new MassTransferAdminDetailResponseDTO(),
      MassTransferAdminResponseDTO.fromAdminBatchResult(detail, names)
    )
    dto.items = detail.items

    return dto
  }
}
