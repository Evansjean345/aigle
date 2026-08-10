import type { DocumentPieceType, KycDocumentType } from '#core/identity/kyc/domain/enum/kyc_enum'
import type { KycAuditContext } from '#core/identity/kyc/application/events/kyc_document_submitted'

// ── Command (input service) ─────────────────────────────────────────

/** Une pièce déposée : son rôle, le fichier, et le numéro qu'elle porte le cas échéant. */
export interface SubmitPieceCommand {
  pieceType: DocumentPieceType
  file: any
  reference?: string
}

/** Dépôt d'une ou plusieurs pièces au dossier d'un compte. */
export interface SubmitVerificationCommand {
  accountId: string
  pieces: SubmitPieceCommand[]
  /** Nature de la pièce d'identité, pour un compte utilisateur. */
  documentType?: KycDocumentType
  auditContext?: KycAuditContext
}

// ── Result (output service) ─────────────────────────────────────────

/** État du dossier après le dépôt. */
export interface SubmitVerificationResult {
  status: string
  /** Rôle attendu ensuite, ou `IN_REVIEW` quand le dossier est complet. */
  nextAction: string
  missingPieces: DocumentPieceType[]
}
