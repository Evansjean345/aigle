import { DocumentPieceType, KycDocumentType } from '#core/identity/kyc/domain/enum/kyc_enum'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'

/** Façon dont un dossier se constitue. */
export enum SubmissionMode {
  ATOMIC = 'atomic',
  PROGRESSIVE = 'progressive',
}

/** Une pièce attendue, et ce qu'elle doit porter. */
export interface RequiredPiece {
  pieceType: DocumentPieceType
  requiresReference: boolean
}

/** Ce qu'un segment doit fournir, comment, et ce que le dossier approuvé lui ouvre. */
export interface VerificationRequirements {
  pieces: RequiredPiece[]
  mode: SubmissionMode
  /**
   * Niveau atteint quand ce dossier est approuvé. `null` quand le segment ne passe aucune
   * vérification.
   *
   * Le niveau doit exister en code avant d'exister en base : c'est ici qu'il prend son sens, pas
   * dans la grille des plafonds, que l'administration ajuste.
   */
  grantsLevel: number | null
}

/** Une pièce telle qu'elle a été reçue, réduite à ce qui décide de la complétude. */
export interface SubmittedPiece {
  pieceType: DocumentPieceType
  hasReference: boolean
}

const identityPiece = (pieceType: DocumentPieceType): RequiredPiece => ({
  pieceType,
  requiresReference: false,
})

const numberedPiece = (pieceType: DocumentPieceType): RequiredPiece => ({
  pieceType,
  requiresReference: true,
})

/**
 * Rend ce qu'un compte doit fournir pour que son dossier soit complet.
 *
 * Le catalogue est la source unique : la règle ne vit ni dans un service, ni dans un validateur de
 * présentation, ni dans une table. Ajouter une pièce s'y fait en une ligne.
 *
 * Un compte marchand n'attend aucune pièce : il encaisse dès sa création et ne passe pas de
 * vérification.
 *
 * @param {AccountSegment} segment - Segment du compte.
 * @param {KycDocumentType} [documentType] - Nature de la pièce d'identité, pour un compte
 *   utilisateur. Un passeport n'a pas de verso.
 * @returns {VerificationRequirements} Les pièces attendues et le mode de soumission.
 */
export function requirementsFor(
  segment: AccountSegment,
  documentType?: KycDocumentType
): VerificationRequirements {
  if (segment === AccountSegment.ENTERPRISE) {
    return {
      pieces: [numberedPiece(DocumentPieceType.RCCM), numberedPiece(DocumentPieceType.DFE)],
      mode: SubmissionMode.PROGRESSIVE,
      grantsLevel: 2,
    }
  }

  if (segment === AccountSegment.MARCHAND) {
    return { pieces: [], mode: SubmissionMode.ATOMIC, grantsLevel: null }
  }

  const pieces = [identityPiece(DocumentPieceType.RECTO)]

  if (documentType !== KycDocumentType.PASSPORT) {
    pieces.push(identityPiece(DocumentPieceType.VERSO))
  }

  pieces.push(identityPiece(DocumentPieceType.SELFIE))

  return { pieces, mode: SubmissionMode.ATOMIC, grantsLevel: 2 }
}

/**
 * Rend les pièces qui manquent encore à un dossier.
 *
 * Une pièce fournie sans sa référence, quand son type en exige une, compte comme absente : un
 * dossier ne part pas en revue avec un numéro d'immatriculation vide.
 *
 * @param {AccountSegment} segment - Segment du compte.
 * @param {KycDocumentType} [documentType] - Nature de la pièce d'identité.
 * @param {SubmittedPiece[]} submitted - Pièces déjà reçues.
 * @returns {DocumentPieceType[]} Les rôles encore attendus, vide si le dossier est complet.
 */
export function missingPieces(
  segment: AccountSegment,
  documentType: KycDocumentType | undefined,
  submitted: SubmittedPiece[]
): DocumentPieceType[] {
  return requirementsFor(segment, documentType)
    .pieces.filter((required) => {
      const piece = submitted.find((candidate) => candidate.pieceType === required.pieceType)

      if (!piece) return true

      return required.requiresReference && !piece.hasReference
    })
    .map((required) => required.pieceType)
}
