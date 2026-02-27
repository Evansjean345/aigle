import { BaseEvent } from '@adonisjs/core/events'
import { KycDocumentStatus } from '#features/kyc/domain/enum/kyc_enum'

export default class KycDocumentSubmitted extends BaseEvent {
  constructor(
    public userId: string,
    public status: KycDocumentStatus
  ) {
    super()
  }
}
