import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

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

  @column()
  declare email: string | null

  @column()
  declare target: 'mobile' | 'email'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
