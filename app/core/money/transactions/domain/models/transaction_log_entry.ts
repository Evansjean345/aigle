import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class TransactionLogEntry extends BaseModel {
  public static table = 'transaction_logs'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'transaction_id' })
  declare transactionId: string

  @column({ columnName: 'event_type' })
  declare eventType: string

  @column()
  declare status: string

  @column()
  declare payload: Record<string, unknown> | null

  @column({ columnName: 'error_message' })
  declare errorMessage: string | null

  @column({ columnName: 'ip_address' })
  declare ipAddress: string | null

  @column({ columnName: 'actor_id' })
  declare actorId: string | null

  @column({ columnName: 'actor_type' })
  declare actorType: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}
