import { BaseEvent } from '@adonisjs/core/events'
import { type KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import { type AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import type { KycAuditContext } from '#core/identity/kyc/application/events/kyc_document_submitted'

/**
 * Une décision de revue vient d'être appliquée à un dossier de vérification.
 *
 * `userId` est nul pour un dossier d'organisation, qui n'a pas d'utilisateur porteur.
 */
export default class KycDocumentProcessed extends BaseEvent {
  constructor(
    public accountId: string,
    public ownerType: AccountOwnerType,
    public userId: string | null,
    public status: KycDocumentStatus,
    public comment?: string,
    public auditContext?: KycAuditContext
  ) {
    super()
  }
}
