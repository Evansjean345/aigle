import { DateTime } from 'luxon'
import type { HasOne } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, hasOne } from '@adonisjs/lucid/orm'

export default class Otp extends BaseModel {
  @hasOne(() => Otp)
  declare otp: HasOne<typeof Otp>

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare user_id: number

  @column({ serializeAs: null })
  declare otp_code: string

  @column()
  declare phone: string | null

  @column()
  declare expires_at: Date | null

  @column()
  declare attempts: number | null

  @column()
  declare locked_until: Date | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
