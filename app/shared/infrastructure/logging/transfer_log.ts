import { BaseLog, BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface TransferLogContext extends BaseLogContext {}

export class TransferLog extends BaseLog {
  constructor() {
    super('transfers_internal')
  }
}

const transferLog = new TransferLog()
export default transferLog
