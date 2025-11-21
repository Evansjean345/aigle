import { KycDocumentType } from '#features/kyc/domain/enum/kyc_enum'

export interface KycDocumentRequestDto {
  documentType: KycDocumentType
  documentRectoUrl: any
  documentVersoUrl: any
}

export interface KycSelfiRequestDto {
  selfiUrl: any
}

export interface KycDocumentResponseDto {
  message: string
  nextAction: string
}
