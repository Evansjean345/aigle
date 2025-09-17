import { DateTime } from 'luxon'
import type { HasOne } from '@adonisjs/lucid/types/relations'
import { BaseModel, column, hasOne } from '@adonisjs/lucid/orm'

export default class Otp extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: string

  @column({ serializeAs: null })
  declare otpCode: string

  @column()
  declare phone: string | null

  @column()
  declare expiresAt: Date | null

  @column()
  declare attempts: number

  @column()
  declare lockedUntil: Date | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasOne(() => Otp)
  declare otp: HasOne<typeof Otp>
}
