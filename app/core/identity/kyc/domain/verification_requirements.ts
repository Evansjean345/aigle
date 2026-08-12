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

/** Ce qu'un palier signifie, et comment un compte y accède. */
export interface LevelMeaning {
  /** Ce que le palier autorise, en une expression — « Identité vérifiée ». */
  title: string
  /** Comment un compte l'atteint — « Après approbation du dossier de vérification ». */
  reachedBy: string
}

/**
 * Signification de chaque palier, par couple `(segment, level)`.
 *
 * Un palier n'est pas un rang abstrait : c'est un état de vérification qui décide de ce qu'un
 * compte peut engager. Cette table est la source unique de cette signification — le back-office
 * l'affiche, il ne l'invente pas. Sans elle, un gestionnaire ajusterait des montants sans savoir
 * qui les subit ni pourquoi.
 *
 * Aucune description n'énumère les pièces attendues : elles sont déjà décrites par
 * `requirementsFor`, et les recopier ici obligerait à modifier deux endroits chaque fois qu'une
 * pièce s'ajoute — sans que rien ne signale l'oubli.
 *
 * Un couple absent d'ici est un palier qu'aucune règle ne prévoit.
 */
const LEVEL_MEANINGS: Record<string, LevelMeaning> = {
  'particulier:1': {
    title: 'Compte non vérifié',
    reachedBy: "Attribué à l'inscription, avant toute vérification d'identité",
  },
  'particulier:2': {
    title: 'Identité vérifiée',
    reachedBy: "Après approbation du dossier d'identité",
  },
  'marchand:1': {
    title: 'Encaissement ouvert',
    reachedBy: 'Attribué à la création : un marchand ne passe aucune vérification',
  },
  'enterprise:0': {
    title: 'En attente de vérification',
    reachedBy: "Attribué à la création : les mouvements restent bloqués jusqu'à l'approbation",
  },
  'enterprise:2': {
    title: 'Entreprise vérifiée',
    reachedBy: "Après approbation du dossier d'entreprise",
  },
}

/**
 * Rend ce qu'un palier signifie.
 *
 * @param {string} segment - Segment du compte.
 * @param {number} level - Rang du palier.
 * @returns {LevelMeaning | null} La signification, ou `null` pour un couple qu'aucune règle ne
 *   prévoit.
 */
export function meaningOfLevel(segment: string, level: number): LevelMeaning | null {
  return LEVEL_MEANINGS[`${segment}:${level}`] ?? null
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
