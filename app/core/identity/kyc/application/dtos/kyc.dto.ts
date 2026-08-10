import { type KycDocumentType } from '#core/identity/kyc/domain/enum/kyc_enum'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

export interface KycDocumentRequestDto {
  documentType: KycDocumentType
  documentRectoUrl: any
  documentVersoUrl: any
  documentsSelfieUrl: any
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  geoLocation?: GeoIpLocation
}

export interface KycDocumentResponseDto {
  message: string
}
