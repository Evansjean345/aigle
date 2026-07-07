import { BaseEvent } from '@adonisjs/core/events'
import { type KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

export interface KycAuditContext {
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  geoLocation?: GeoIpLocation
}

export default class KycDocumentSubmitted extends BaseEvent {
  constructor(
    public userId: string,
    public status: KycDocumentStatus,
    public auditContext?: KycAuditContext
  ) {
    super()
  }
}
