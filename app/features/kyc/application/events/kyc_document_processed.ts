import { BaseEvent } from '@adonisjs/core/events'
import { KycDocumentStatus } from '#features/kyc/domain/enum/kyc_enum'
import type { KycAuditContext } from '#features/kyc/application/events/kyc_document_submitted'

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
