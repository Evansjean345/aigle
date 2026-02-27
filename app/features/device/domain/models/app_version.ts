import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { DeviceType } from '#features/device/domain/enums'

export default class AppVersion extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare deviceType: DeviceType

  @column()
  declare versionNumber: string

  @column()
  declare minVersion: string

  @column()
  declare criticalUpdate: boolean

  @column.date()
  declare releaseDate: DateTime

  @column()
  declare downloadUrl: string | null

  @column()
  declare changelog: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
