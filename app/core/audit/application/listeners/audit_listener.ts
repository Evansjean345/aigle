import { inject } from '@adonisjs/core'
import { AuditRecordInput } from '#core/audit/infrastructure/audit_service'
import auditService from '#core/audit/infrastructure/audit_service'
import ledgerLog from '#shared/infrastructure/logging/ledger_log'

@inject()
export default class AuditListener {
  async handle(data: AuditRecordInput): Promise<void> {
    try {
      await auditService.record(data)
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
