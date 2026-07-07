import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import { DeviceStatus } from '#core/identity/device/domain/enums'
import Device from '#core/identity/device/domain/models/device'
import User from '#core/identity/user/domain/models/user'

export default class UserDevice extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare deviceId: string

  @column()
  declare status: DeviceStatus

  @column()
  declare isPrimary: boolean

  @column()
  declare pushToken?: string | null

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

  @column.dateTime()
  declare linkedAt: DateTime

  @column.dateTime()
  declare lastSeenAt?: DateTime

  @column.dateTime()
  declare unlinkedAt?: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Device)
  declare device: BelongsTo<typeof Device>

  @belongsTo(() => User, {
    foreignKey: 'userId',
    localKey: 'usersUid',
  })
  declare user: BelongsTo<typeof User>

  @beforeCreate()
  static async generateId(userDevice: UserDevice) {
    if (!userDevice.id) {
      userDevice.id = crypto.randomUUID()
    }
  }
}
