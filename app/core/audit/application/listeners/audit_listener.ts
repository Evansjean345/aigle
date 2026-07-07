import { inject } from '@adonisjs/core'
import { type AuditRecordInput } from '#core/audit/domain/audit_record_input'
import AuditRecorder from '#core/audit/domain/interfaces/audit_recorder'
import ledgerLog from '#shared/infrastructure/logging/ledger_log'

@inject()
export default class AuditListener {
  constructor(private readonly auditRecorder: AuditRecorder) {}

  async handle(data: AuditRecordInput): Promise<void> {
    try {
      await this.auditRecorder.record(data)
    } catch (error) {
      ledgerLog.error(
        'AUDIT_DB_FALLBACK',
        {
          ...data,
          fallback: true,
          error: (error as Error).message,
        },
        'Audit DB write failed, fallback to ledger_log'
      )
    }
  }
}
