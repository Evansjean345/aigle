import { type DocumentPieceType } from '#core/identity/kyc/domain/enum/kyc_enum'
import { missingPieces, requirementsFor } from '#core/identity/kyc/domain/verification_requirements'
import type { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import type { KycAuditContext } from '#core/identity/kyc/application/events/kyc_document_submitted'
import type { KycDocumentResult } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

// ── Command (input use case) ────────────────────────────────────────

/** Dépôt d'une pièce au dossier de vérification d'une organisation. */
export interface SubmitKybPieceCommand {
  organisationId: string
  pieceType: DocumentPieceType
  reference: string
  document: any
  auditContext?: KycAuditContext
}

// ── Response (output use case) ──────────────────────────────────────

/** Une pièce déjà déposée, telle que l'entreprise la voit. */
export interface KybSubmittedPiece {
  pieceType: string
  reference?: string
}

/**
 * État du dossier tel que l'entreprise le consulte : ce qui est déposé, ce qui manque.
 *
 * Ne porte ni fichier ni clé de stockage — l'entreprise sait ce qu'elle a déposé, elle n'a pas
 * besoin de relire ses pièces.
 */
export class KybFileResponseDto {
  declare status: string | null
  declare nextAction: string | null
  declare submittedPieces: KybSubmittedPiece[]
  declare missingPieces: DocumentPieceType[]

  /**
   * Compose l'état à partir du dossier, présent ou non.
   *
   * Un compte sans dossier attend sa première pièce : le statut est nul et la prochaine action est
   * la première pièce du catalogue.
   *
   * @param {AccountSegment} segment - Segment du compte, qui détermine les pièces attendues.
   * @param {KycDocumentResult | null} document - Dossier existant, ou `null`.
   * @returns {KybFileResponseDto} L'état consultable.
   */
  static fromDocument(
    segment: AccountSegment,
    document: KycDocumentResult | null
  ): KybFileResponseDto {
    const dto = new KybFileResponseDto()

    const submitted: KybSubmittedPiece[] = (document?.pieces ?? []).map((piece) => ({
      pieceType: piece.pieceType,
      reference: piece.reference,
    }))

    dto.status = document?.status ?? null
    dto.nextAction = document?.nextAction ?? requirementsFor(segment).pieces[0]?.pieceType ?? null
    dto.submittedPieces = submitted
    dto.missingPieces = missingPieces(
      segment,
      undefined,
      submitted.map((piece) => ({
        pieceType: piece.pieceType as DocumentPieceType,
        hasReference: Boolean(piece.reference?.trim()),
      }))
    )

    return dto
  }
}
