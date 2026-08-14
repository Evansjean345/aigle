import type Organisation from '#aiglebusiness/organisation/domain/models/organisation'
import type { KycDocumentResult } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'
import type { BusinessReviewResult } from '#core/identity/kyc/application/dtos/admin/admin_business_review.dto'

/**
 * Dossier de vérification vu du back-office, l'entreprise nommée.
 *
 * Le core rend un dossier attaché à un `accountId` : il ne connaît pas les organisations, et ne
 * doit pas les connaître. C'est le produit qui les nomme, en composant les deux lectures ici.
 */

/** Entreprise derrière le dossier, réduite à ce que la revue affiche. */
export interface AdminKybOrganisationRef {
  organisationId: string
  name: string
  accountType: string
}

/** Projette une organisation sur ce que la revue en montre. */
const toOrganisationRef = (organisation: Organisation): AdminKybOrganisationRef => ({
  organisationId: organisation.organisationId,
  name: organisation.name,
  accountType: organisation.accountType,
})

/**
 * Ligne de la file de revue.
 *
 * Porte ce que la file affiche, et rien de plus : ni clé de stockage, ni agent, ni historique. Une
 * `fileKey` est un chemin sur le stockage privé — elle n'a aucune raison de traverser une liste que
 * personne n'ouvre pièce par pièce.
 */
export class AdminKybListItemDto {
  declare id: number
  declare accountId: string
  declare status: string
  declare createdAt: string
  /** Motif de la dernière décision, ce que la ligne montre sur un dossier refusé. */
  declare comment?: string
  /** Rôles déposés, sans les fichiers : de quoi dire ce qui manque encore. */
  declare depositedPieces: string[]
  declare organisation: AdminKybOrganisationRef | null

  /**
   * Réduit un dossier à sa ligne de file.
   *
   * @param {KycDocumentResult} document - Dossier tel que le core le rend.
   * @param {Organisation | undefined} organisation - Entreprise porteuse, si elle a été retrouvée.
   * @returns {AdminKybListItemDto} La ligne.
   */
  static fromDocument(
    document: KycDocumentResult,
    organisation?: Organisation
  ): AdminKybListItemDto {
    const dto = new AdminKybListItemDto()

    dto.id = document.id
    dto.accountId = document.accountId
    dto.status = document.status
    dto.createdAt = document.createdAt
    dto.comment = document.comment
    dto.depositedPieces = (document.pieces ?? []).map((piece) => piece.pieceType)
    dto.organisation = organisation ? toOrganisationRef(organisation) : null

    return dto
  }
}

/** Dossier d'entreprise servi par la revue. */
export class AdminKybFileDto {
  declare id: number
  declare accountId: string
  declare ownerType: string
  declare status: string
  declare nextAction?: string
  declare comment?: string
  declare createdAt: string
  declare pieces?: KycDocumentResult['pieces']
  declare agent?: KycDocumentResult['agent']
  declare attempts?: KycDocumentResult['attempts']
  /** Absente quand l'organisation ne se retrouve pas — le dossier reste consultable. */
  declare organisation: AdminKybOrganisationRef | null

  /**
   * Compose le dossier et son entreprise.
   *
   * @param {KycDocumentResult} document - Dossier tel que le core le rend.
   * @param {Organisation | undefined} organisation - Entreprise porteuse, si elle a été retrouvée.
   * @returns {AdminKybFileDto} Le dossier nommé.
   */
  static fromDocument(document: KycDocumentResult, organisation?: Organisation): AdminKybFileDto {
    const dto = new AdminKybFileDto()

    dto.id = document.id
    dto.accountId = document.accountId
    dto.ownerType = document.ownerType
    dto.status = document.status
    dto.nextAction = document.nextAction
    dto.comment = document.comment
    dto.createdAt = document.createdAt
    dto.pieces = document.pieces
    dto.agent = document.agent
    dto.attempts = document.attempts
    dto.organisation = organisation ? toOrganisationRef(organisation) : null

    return dto
  }
}

/** Dossier en revue, avec le niveau que porte réellement le compte. */
export class AdminKybReviewDto {
  declare document: AdminKybFileDto
  declare accountLevel: number | null
  declare levelMismatch: boolean

  /**
   * Compose la revue d'un dossier et son entreprise.
   *
   * @param {BusinessReviewResult} review - Revue telle que le core la rend.
   * @param {Organisation | undefined} organisation - Entreprise porteuse, si elle a été retrouvée.
   * @returns {AdminKybReviewDto} La revue nommée.
   */
  static fromReview(review: BusinessReviewResult, organisation?: Organisation): AdminKybReviewDto {
    const dto = new AdminKybReviewDto()

    dto.document = AdminKybFileDto.fromDocument(review.document, organisation)
    dto.accountLevel = review.accountLevel
    dto.levelMismatch = review.levelMismatch

    return dto
  }
}

/** Page de la file de revue. */
export interface AdminKybPageDto {
  data: AdminKybListItemDto[]
  meta: Record<string, unknown>
}
