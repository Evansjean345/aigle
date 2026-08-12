import { DocumentPieceType, KycDocumentType } from '#core/identity/kyc/domain/enum/kyc_enum'
import { VerificationProfile } from '#core/identity/kyc/domain/verification_profile'
import { levelDefinitionOf } from '#core/identity/kyc/domain/kyc_level_catalog'
import UnknownVerificationProfileException from '#core/identity/kyc/domain/exceptions/unknown_verification_profile_exception'

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

/** Ce qu'un profil doit fournir, comment, et les paliers qu'il encadre. */
export interface VerificationRequirements {
  pieces: RequiredPiece[]
  mode: SubmissionMode
  startsAtLevel: number
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
 * Un profil `NONE` n'attend aucune pièce et n'accorde aucun palier : le compte encaisse dès sa
 * création.
 *
 * @param {VerificationProfile} profile - Jeu de pièces attendu du compte.
 * @param {KycDocumentType} [documentType] - Nature de la pièce d'identité, pour un dossier
 *   d'identité. Un passeport n'a pas de verso.
 * @returns {VerificationRequirements} Les pièces attendues, le mode de soumission et les paliers.
 * @throws {UnknownVerificationProfileException} Profil hors catalogue.
 */
export function requirementsFor(
  profile: VerificationProfile,
  documentType?: KycDocumentType
): VerificationRequirements {
  if (profile === VerificationProfile.IDENTITE) {
    const pieces = [identityPiece(DocumentPieceType.RECTO)]

    if (documentType !== KycDocumentType.PASSPORT) {
      pieces.push(identityPiece(DocumentPieceType.VERSO))
    }

    pieces.push(identityPiece(DocumentPieceType.SELFIE))

    return { pieces, mode: SubmissionMode.ATOMIC, startsAtLevel: 1, grantsLevel: 2 }
  }

  if (profile === VerificationProfile.IMMATRICULATION) {
    return {
      pieces: [numberedPiece(DocumentPieceType.RCCM), numberedPiece(DocumentPieceType.DFE)],
      mode: SubmissionMode.PROGRESSIVE,
      startsAtLevel: 0,
      grantsLevel: 2,
    }
  }

  if (profile === VerificationProfile.NONE) {
    return { pieces: [], mode: SubmissionMode.ATOMIC, startsAtLevel: 1, grantsLevel: null }
  }

  throw new UnknownVerificationProfileException(profile)
}

/** Ce qu'un palier signifie, et comment un compte y accède. */
export interface LevelMeaning {
  title: string
  reachedBy: string
}

/**
 * Rend ce qu'un palier signifie, d'après le catalogue.
 *
 * @param {string} segment - Segment du compte.
 * @param {number} level - Rang du palier.
 * @returns {LevelMeaning | null} La signification, ou `null` pour un couple qu'aucune règle ne
 *   prévoit.
 */
export function meaningOfLevel(segment: string, level: number): LevelMeaning | null {
  const definition = levelDefinitionOf(segment, level)

  return definition ? { title: definition.title, reachedBy: definition.reachedBy } : null
}

/**
 * Rend les pièces qui manquent encore à un dossier.
 *
 * Une pièce fournie sans sa référence, quand son type en exige une, compte comme absente : un
 * dossier ne part pas en revue avec un numéro d'immatriculation vide.
 *
 * @param {VerificationProfile} profile - Jeu de pièces attendu du compte.
 * @param {KycDocumentType} [documentType] - Nature de la pièce d'identité.
 * @param {SubmittedPiece[]} submitted - Pièces déjà reçues.
 * @returns {DocumentPieceType[]} Les rôles encore attendus, vide si le dossier est complet.
 */
export function missingPieces(
  profile: VerificationProfile,
  documentType: KycDocumentType | undefined,
  submitted: SubmittedPiece[]
): DocumentPieceType[] {
  return requirementsFor(profile, documentType)
    .pieces.filter((required) => {
      const piece = submitted.find((candidate) => candidate.pieceType === required.pieceType)

      if (!piece) return true

      return required.requiresReference && !piece.hasReference
    })
    .map((required) => required.pieceType)
}
