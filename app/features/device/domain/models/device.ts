import { BaseModel, beforeCreate, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { DeviceStatus } from '#features/device/domain/enums'
import { cuid } from '@adonisjs/core/helpers'

export default class Device extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

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

  @column()
  declare ipFirstSeen?: string

  @column()
  declare ipLastSeen?: string

  @column()
  declare isVpn: boolean

  @column()
  declare firstCountryCode?: string

  @column()
  declare lastCountryCode?: string

  @column()
  declare status: DeviceStatus

  @column()
  declare isPrimary: boolean

  @column()
  declare pushToken?: string | null

  @column.dateTime()
  declare lastSeenAt?: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @beforeCreate()
  static async generateId(device: Device) {
    if (!device.id) {
      device.id = cuid()
    }
  }
}
