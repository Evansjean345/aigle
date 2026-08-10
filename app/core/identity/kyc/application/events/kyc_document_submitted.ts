import { BaseEvent } from '@adonisjs/core/events'
import { type KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { type AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import type { GeoIpLocation } from '#shared/infrastructure/services/geoip_service'

export interface KycAuditContext {
  ipAddress?: string | null
  userAgent?: string | null
  requestId?: string | null
  geoLocation?: GeoIpLocation
}

/**
 * Un dossier de vérification vient d'être soumis à la revue.
 *
 * Émis quand le dossier devient complet, jamais pendant sa constitution. `userId` est nul pour un
 * dossier d'organisation, qui n'a pas d'utilisateur porteur.
 */
export default class KycDocumentSubmitted extends BaseEvent {
  constructor(
    public accountId: string,
    public ownerType: AccountOwnerType,
    public userId: string | null,
    public status: KycDocumentStatus,
    public auditContext?: KycAuditContext
  ) {
    super()
  }
}
