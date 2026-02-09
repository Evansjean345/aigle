import { BaseLog, BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface KycLogContext extends BaseLogContext {}

export class KycLog extends BaseLog {
  constructor() {
    super('kyc_documents')
  }
}

const kycLog = new KycLog()
export default kycLog
