import type FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import type { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'
import type { CollectionAccountAdminResponseDTO } from '#aiglebusiness/funding/application/dtos/admin/admin_collection_account.dto'

/**
 * Contrats admin des demandes de réapprovisionnement.
 *
 * Canal séparé du contrat marchand (`dtos/funding_request.dto.ts`) et non dérivé de lui : la trace
 * des décisions internes — commentaires d'attestation, seuil appliqué, identité des valideurs —
 * n'atteint pas le marchand.
 */

// ── Result (output service) ─────────────────────────────────────────

/**
 * Acteur d'une demande, avec son nom résolu.
 *
 * Le nom peut être `null` si l'acteur a disparu : l'identifiant reste alors la seule trace, et il ne
 * faut pas le masquer.
 */
export interface FundingActorRef {
  id: string | number
  name: string | null
}

/** Tables de noms résolues pour un lot de demandes, indexées par identifiant. */
export interface FundingActorNamesResult {
  users: Map<string, string>
  admins: Map<number, string>
  organisations: Map<string, string>
}

// ── Response (output HTTP) ──────────────────────────────────────────

/** Demande telle que la voit le back-office, avec la trace complète de la décision. */
export class FundingRequestAdminResponseDTO {
  declare reference: string
  declare declaredAmount: number
  declare status: FundingRequestStatus
  /** URL signée et temporaire du justificatif, à ne pas mettre en cache. */
  declare documentUrl: string
  declare collectionAccount: CollectionAccountAdminResponseDTO | null
  declare declaredAt: string
  declare cancelledAt: string | null
  declare organisationId: string
  declare declaredByUserId: string
  /** Organisation, avec son nom quand il a pu être résolu. */
  declare organisation: FundingActorRef
  /** Membre ayant déclaré le versement. */
  declare declaredBy: FundingActorRef
  /** Gestionnaire ayant clos le dossier. `null` tant qu'il ne l'est pas. */
  declare reviewedBy: FundingActorRef | null
  /** Premier valideur, uniquement quand deux valideurs ont été exigés. */
  declare firstApprovedBy: FundingActorRef | null
  declare verifiedAmount: number | null
  /** `verifiedAmount - declaredAmount`. Négatif quand le crédit est inférieur au déclaré. */
  declare amountGap: number | null
  declare reviewedByAdminId: number | null
  declare reviewedAt: string | null
  /** Commentaire de la décision qui clôt le dossier. */
  declare reviewComment: string | null
  /** Commentaire du premier valideur, quand deux valideurs ont été exigés. */
  declare firstApprovalComment: string | null
  /** Gestionnaire ayant donné la première approbation, quand deux valideurs sont exigés. */
  declare firstApprovedByAdminId: number | null
  declare firstApprovedAt: string | null
  /** Seuil de double validation en vigueur au moment de la décision. */
  declare approvalThresholdApplied: number | null
  /** Indique si la demande attend la confirmation d'un second gestionnaire. */
  declare awaitsSecondApproval: boolean

  /**
   * Construit la vue admin d'une demande, avec l'écart entre montant déclaré et montant crédité.
   *
   * @param {FundingRequest} request - Demande chargée depuis le repository.
   * @param {string} documentUrl - URL signée du justificatif, générée à la volée.
   * @param {CollectionAccountAdminResponseDTO | null} collectionAccount - Compte de collecte visé,
   * `null` s'il est introuvable.
   * @param {FundingActorNamesResult} names - Noms des acteurs, résolus pour l'ensemble du lot.
   * @returns {FundingRequestAdminResponseDTO} La vue destinée au back-office.
   */
  static fromRequest(
    request: FundingRequest,
    documentUrl: string,
    collectionAccount: CollectionAccountAdminResponseDTO | null,
    names: FundingActorNamesResult
  ): FundingRequestAdminResponseDTO {
    const dto = new FundingRequestAdminResponseDTO()
    const verifiedAmount = request.verifiedAmount === null ? null : Number(request.verifiedAmount)

    /** Référence d'administrateur, `null` si aucun identifiant n'est renseigné. */
    const adminRef = (id: number | null): FundingActorRef | null =>
      id === null ? null : { id, name: names.admins.get(id) ?? null }

    dto.reference = request.reference
    dto.declaredAmount = Number(request.declaredAmount)
    dto.status = request.status
    dto.documentUrl = documentUrl
    dto.collectionAccount = collectionAccount
    dto.declaredAt = request.createdAt.toISO() ?? ''
    dto.cancelledAt = request.cancelledAt?.toISO() ?? null

    dto.organisationId = request.organisationId
    dto.declaredByUserId = request.declaredByUserId
    dto.organisation = {
      id: request.organisationId,
      name: names.organisations.get(request.organisationId) ?? null,
    }
    dto.declaredBy = {
      id: request.declaredByUserId,
      name: names.users.get(request.declaredByUserId) ?? null,
    }
    dto.reviewedBy = adminRef(request.reviewedByAdminId)
    dto.firstApprovedBy = adminRef(request.firstApprovedByAdminId)

    dto.verifiedAmount = verifiedAmount
    dto.amountGap = verifiedAmount === null ? null : verifiedAmount - Number(request.declaredAmount)
    dto.reviewedByAdminId = request.reviewedByAdminId
    dto.reviewedAt = request.reviewedAt?.toISO() ?? null
    dto.reviewComment = request.reviewComment
    dto.firstApprovalComment = request.firstApprovalComment
    dto.firstApprovedByAdminId = request.firstApprovedByAdminId
    dto.firstApprovedAt = request.firstApprovedAt?.toISO() ?? null
    dto.approvalThresholdApplied =
      request.approvalThresholdApplied === null ? null : Number(request.approvalThresholdApplied)
    dto.awaitsSecondApproval = request.awaitsSecondApproval

    return dto
  }
}
