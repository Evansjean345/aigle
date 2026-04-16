import { KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'
import type KycDocument from '#features/kyc/domain/models/kyc_document'

export interface KycDocumentRequestDto {
  documentType: KycDocumentType
  documentRectoUrl: any
  documentVersoUrl: any
  documentsSelfieUrl: any
}

export interface KycDocumentResponseDto {
  message: string
  nextAction: string
}

export class AdminKycListDto {
  declare id: number
  declare userId: string
  declare documentType: string
  declare documentRectoUrl?: string
  declare documentVersoUrl?: string
  declare selfieUrl?: string
  declare status: string
  declare comment?: string
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

  static fromKycDocument(kyc: KycDocument): AdminKycListDto {
    const dto = new AdminKycListDto()
    dto.id = kyc.id
    dto.userId = kyc.userId
    dto.documentType = kyc.documentType
    dto.documentRectoUrl = kyc.documentRectoUrl
    dto.documentVersoUrl = kyc.documentVersoUrl
    dto.selfieUrl = kyc.selfieUrl
    dto.status = kyc.status
    dto.comment = kyc.comment
    dto.createdAt = kyc.createdAt?.toISO() || kyc.createdAt?.toString() || ''
    dto.agent = kyc.agent
      ? {
          id: kyc.agent.id,
          firstname: kyc.agent.firstname,
          lastname: kyc.agent.lastname,
          email: kyc.agent.email,
        }
      : undefined
    dto.attempts = kyc.attempts?.map((attempt) => ({
      ...attempt.toJSON(),
      agent: attempt.agent
        ? {
            id: attempt.agent.id,
            firstname: attempt.agent.firstname,
            lastname: attempt.agent.lastname,
            email: attempt.agent.email,
          }
        : undefined,
    }))
    dto.user = kyc.user
      ? {
          firstname: kyc.user.firstname,
          lastname: kyc.user.lastname,
          usersUid: kyc.user.usersUid,
          kycLevel: kyc.user.kycLevel,
          kycStatus: kyc.user.kycStatus,
          phone: kyc.user.phone,
          status: kyc.user.status,
        }
      : undefined
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
}
