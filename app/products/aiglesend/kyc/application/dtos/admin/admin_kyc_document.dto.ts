import type { KycDocumentResult } from '#core/identity/kyc/application/dtos/admin/admin_kyc_document.dto'

/**
 * Vues du back-office pour les dossiers de vérification d'identité.
 *
 * Façonnent la réponse HTTP servie par `aiglesend` : le core rend un `Result`, le produit décide de
 * ce qu'il expose.
 */

export class AdminKycListDto {
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
  declare agent?: {
    id: number
    firstname: string
    lastname: string
    email: string
  }
  declare attempts?: any[]
  declare user?: {
    firstname: string
    lastname: string
    usersUid: string
    kycLevel: number
    kycStatus: string
    status: string
    phone: string
  }

  /**
   * Construit la vue admin depuis le document projeté par le service.
   *
   * @param {KycDocumentResult} kyc - Document projeté.
   * @returns {AdminKycListDto} La vue destinée au back-office.
   */
  static fromResult(kyc: KycDocumentResult): AdminKycListDto {
    const dto = new AdminKycListDto()
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
