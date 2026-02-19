import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class AuditLog extends BaseModel {
  public static connection = 'audit'
  public static table = 'audit_logs'

  @column({ isPrimary: true })
  declare id: string // uuid

  // New event structure
  @column({ columnName: 'event_category' })
  declare eventCategory: string | null

  @column({ columnName: 'event_action' })
  declare eventAction: string | null

  // Actor info
  @column({ columnName: 'actor_id' })
  declare actorId: string | number | null

  @column({ columnName: 'actor_type' })
  declare actorType: string | number | null

  @column({ columnName: 'actor_role' })
  declare actorRole: string | null

  @column({ columnName: 'initiated_by_id' })
  declare initiatedBy: string | number | null

  @column({ columnName: 'initiated_by_type' })
  declare initiatedByType: string | null

  // Target info
  @column({ columnName: 'target_type' })
  declare targetType: string | null

  @column({ columnName: 'target_id' })
  declare targetId: string | null

  // Request context
  @column({ columnName: 'request_id' })
  declare requestId: string | null

  @column({ columnName: 'ip_address' })
  declare ipAddress: string | null

  @column({ columnName: 'user_agent' })
  declare userAgent: string | null

  // Changes and metadata
  @column({ columnName: 'old_values' })
  declare oldValues: Record<string, unknown> | null

  @column({ columnName: 'new_values' })
  declare newValues: Record<string, unknown> | null

  @column({ columnName: 'metadata' })
  declare metadata: Record<string, unknown> | null

  // Outcome
  @column()
  declare result: string | null

  @column({ columnName: 'error_code' })
  declare errorCode: string | null

  @column({ columnName: 'error_message' })
  declare errorMessage: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
