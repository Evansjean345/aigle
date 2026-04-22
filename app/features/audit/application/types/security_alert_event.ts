import { type DateTime } from 'luxon'
import { type SecurityAlertType, type AlertSeverity } from '#features/audit/domain/enums'

export interface SecurityAlertEvent {
  type: SecurityAlertType
  severity: AlertSeverity
  actorId: string
  actorType: string
  ipAddress: string
  metadata: Record<string, any>
  detectedAt: DateTime
}
