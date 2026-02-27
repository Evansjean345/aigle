import { BaseLog, BaseLogContext } from '#shared/infrastructure/logging/base_log'

export interface LedgerLogContext extends BaseLogContext {}

export class LedgerLog extends BaseLog {
  constructor() {
    super('audit_ledger')
  }
}

const ledgerLog = new LedgerLog()
export default ledgerLog
