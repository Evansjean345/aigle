import { BaseEvent } from '@adonisjs/core/events'
import { KycDocumentStatus } from '#core/kyc/domain/enum/kyc_enum'
import type { KycAuditContext } from '#core/kyc/application/events/kyc_document_submitted'

export default class KycDocumentProcessed extends BaseEvent {
  constructor(
    public userId: string,
    public status: KycDocumentStatus,
    public comment?: string,
    public auditContext?: KycAuditContext
  ) {
    super()
  }
}
