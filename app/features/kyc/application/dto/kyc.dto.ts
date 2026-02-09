import { KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'

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

export interface AdminKycListDto {
  id: number
  userId: string
  documentType: string
  documentRectoUrl?: string
  documentVersoUrl?: string
  selfieUrl?: string
  status: string
  comment?: string
  createdAt: string
  attempts?: any[]
  user?: {
    firstname: string
    lastname: string
    usersUid: string
    kycLevel: number
    kycStatus: string
    status: string
    phone: string
  }
}

export interface KycStatsDto {
  total: number
  pending: number
  verified: number
  rejected: number
  byDocumentType: {
    CNI: number
    PASSPORT: number
    PERMIT_CONDUIT: number
  }
}
