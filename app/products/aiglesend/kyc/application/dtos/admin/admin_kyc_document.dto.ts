import type { KycDocumentResult } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Vues du back-office pour les dossiers de vérification d'identité.
 *
 * Façonnent la réponse HTTP servie par `aiglesend` : le core rend un `Result`, le produit décide de
 * ce qu'il expose. La **liste** et le **détail** sont deux vues distinctes — une file de vingt
 * dossiers n'a pas à transporter ce qu'un seul écran de revue affiche.
 */

/** Porteur du dossier, tel que la revue le montre. */
interface AdminKycOwner {
  firstname: string
  lastname: string
  usersUid: string
  kycLevel: number
  kycStatus: string
  status: string
  phone: string
}

/** Gestionnaire ayant traité le dossier. */
interface AdminKycAgent {
  id: number
  firstname: string
  lastname: string
  email: string
}

/**
 * Ligne de la file de revue.
 *
 * Ne porte ni image, ni agent, ni historique : la file affiche un porteur, un statut et une date.
 * Les pièces se consultent au détail, où elles sont signées.
 */
export class AdminKycListDto {
  declare id: number
  declare userId: string
  declare documentType?: string
  declare status: string
  /** Motif de la dernière décision, ce que la ligne montre sur un dossier refusé. */
  declare comment?: string
  declare createdAt: string
  declare user?: AdminKycOwner

  /**
   * Réduit un dossier à sa ligne de file.
   *
   * @param {KycDocumentResult} kyc - Document projeté par le service.
   * @returns {AdminKycListDto} La ligne.
   */
  static fromResult(kyc: KycDocumentResult): AdminKycListDto {
    const dto = new AdminKycListDto()

    dto.id = kyc.id
    dto.userId = kyc.userId
    dto.documentType = kyc.documentType
    dto.status = kyc.status
    dto.comment = kyc.comment
    dto.createdAt = kyc.createdAt
    dto.user = kyc.user

    return dto
  }
}

/**
 * Dossier ouvert en revue.
 *
 * Porte les images — signées à la lecture — l'agent qui a décidé et l'historique des tentatives.
 */
export class AdminKycDetailDto {
  declare id: number
  declare userId: string
  declare documentType?: string
  declare documentRectoUrl?: string
  declare documentVersoUrl?: string
  declare selfieUrl?: string
  declare status: string
  declare comment?: string
  declare validUntil?: string
  declare createdAt: string
  declare agent?: AdminKycAgent
  declare attempts?: any[]
  declare user?: AdminKycOwner

  /**
   * Construit la vue de détail depuis le document projeté par le service.
   *
   * @param {KycDocumentResult} kyc - Document projeté, pièces signées comprises.
   * @returns {AdminKycDetailDto} La vue destinée à l'écran de revue.
   */
  static fromResult(kyc: KycDocumentResult): AdminKycDetailDto {
    const dto = new AdminKycDetailDto()

    dto.id = kyc.id
    dto.userId = kyc.userId
    dto.documentType = kyc.documentType
    dto.documentRectoUrl = kyc.documentRectoUrl
    dto.documentVersoUrl = kyc.documentVersoUrl
    dto.selfieUrl = kyc.selfieUrl
    dto.status = kyc.status
    dto.comment = kyc.comment
    dto.validUntil = kyc.validUntil
    dto.createdAt = kyc.createdAt
    dto.agent = kyc.agent
    dto.attempts = kyc.attempts
    dto.user = kyc.user

    return dto
  }
}

export class KycStatsDto {
  declare total: number
  declare pending: number
  declare verified: number
  declare rejected: number
  /** Dossier commencé dont une pièce requise manque encore. */
  declare inSubmission: number
  declare byDocumentType: {
    CNI: number
    PASSPORT: number
    PERMIT_CONDUIT: number
  }
  declare today: {
    submitted: number
    approved: number
    rejected: number
    processed: number
  }
}
