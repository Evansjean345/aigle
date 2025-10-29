import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class Device extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare token: string

  @column()
  declare userId?: string

  @column()
  declare appVersion?: string

  @column()
  declare iosAppVersion?: string

  @column()
  declare androidAppVersion?: string

  @column()
  declare platform?: string

  @column()
  declare platformVersion?: string

  @column()
  declare userAgent?: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
