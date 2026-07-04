import { BaseModel, beforeCreate, column, hasMany } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import UserDevice from '#core/device/domain/models/user_device'

export default class Device extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare fingerprintHash: string

  @column()
  declare deviceUid: string

  @column()
  declare platform?: string

  @column()
  declare brand?: string

  @column()
  declare model?: string

  @column()
  declare osVersion?: string

  @column()
  declare appVersion?: string

  @column()
  declare isEmulator: boolean

  @column()
  declare isRooted: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @beforeCreate()
  static async generateId(device: Device) {
    if (!device.id) {
      device.id = crypto.randomUUID()
    }
  }

  @hasMany(() => UserDevice)
  declare sessions: HasMany<typeof UserDevice>
}
