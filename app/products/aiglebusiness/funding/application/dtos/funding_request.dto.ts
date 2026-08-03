import type FundingRequest from '#aiglebusiness/funding/domain/models/funding_request'
import type { FundingRequestStatus } from '#aiglebusiness/funding/domain/enums/funding_request_status'
import type { CollectionAccountResponseDTO } from '#aiglebusiness/funding/application/dtos/collection_account.dto'

/**
 * Contrats des demandes de réapprovisionnement.
 *
 * Aucun modèle Lucid ne franchit la frontière HTTP. La clé de stockage du justificatif n'est jamais
 * exposée : le client reçoit une URL signée.
 *
 * Canal client : ce que voit le marchand sur ses propres demandes. Le back-office a ses propres
 * contrats dans `dtos/admin/admin_funding_request.dto.ts` — les deux ne se dérivent pas l'un de
 * l'autre.
 */

// ── Command (input service) ─────────────────────────────────────────

/** Déclaration d'un versement par le marchand. */
export interface DeclareFundingRequestCommand {
  organisationId: string
  declaredByUserId: string
  collectionAccountReference: string
  declaredAmount: number
  /** Fichier multipart déjà validé, déposé sur le stockage privé par le service. */
  document: unknown
}

/** Validation d'une demande par un gestionnaire. Déclenche le crédit du wallet. */
export interface ApproveFundingRequestCommand {
  reference: string
  /** Montant constaté sur le justificatif. Ne peut pas dépasser le montant déclaré. */
  verifiedAmount: number
  /** Identifiant du gestionnaire, pris de la session et non du corps de la requête. */
  adminId: number
  /** Attestation de ce qui a été vérifié. Obligatoire. */
  comment: string
}

/**
 * Confirmation par un second gestionnaire d'une demande dépassant le seuil.
 *
 * Ne porte volontairement pas de montant : le second contrôle le constat du premier, il ne le
 * corrige pas.
 */
export interface ConfirmFundingRequestCommand {
  reference: string
  /** Gestionnaire qui confirme. Doit différer du premier valideur. */
  adminId: number
  /** Attestation du second contrôle. Obligatoire. */
  comment: string
}

/** Refus d'une demande par un gestionnaire. */
export interface RejectFundingRequestCommand {
  reference: string
  adminId: number
  /** Motif du refus, obligatoire. */
  comment: string
}

// ── Response (output HTTP) ──────────────────────────────────────────

/** Demande telle que la voit le marchand. */
export class FundingRequestResponseDTO {
  declare reference: string
  declare declaredAmount: number
  declare status: FundingRequestStatus
  /** URL signée et temporaire du justificatif, à ne pas mettre en cache. */
  declare documentUrl: string
  declare collectionAccount: CollectionAccountResponseDTO | null
  declare declaredAt: string
  declare cancelledAt: string | null

  /**
   * Construit la vue marchand d'une demande.
   *
   * @param {FundingRequest} request - Demande chargée depuis le repository.
   * @param {string} documentUrl - URL signée du justificatif, générée à la volée.
   * @param {CollectionAccountResponseDTO | null} collectionAccount - Compte de collecte visé,
   * `null` s'il est introuvable.
   * @returns {FundingRequestResponseDTO} La vue destinée au marchand.
   */
  static fromRequest(
    request: FundingRequest,
    documentUrl: string,
    collectionAccount: CollectionAccountResponseDTO | null
  ): FundingRequestResponseDTO {
    const dto = new FundingRequestResponseDTO()
    dto.reference = request.reference
    dto.declaredAmount = Number(request.declaredAmount)
    dto.status = request.status
    dto.documentUrl = documentUrl
    dto.collectionAccount = collectionAccount
    dto.declaredAt = request.createdAt.toISO() ?? ''
    dto.cancelledAt = request.cancelledAt?.toISO() ?? null

    return dto
  }
}
