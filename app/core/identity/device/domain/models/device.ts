import { BaseModel, beforeCreate, column, hasMany } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import UserDevice from '#core/identity/device/domain/models/user_device'
import { type DeviceIdentity } from '#core/identity/device/domain/enums/device_identity'

export default class Device extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare fingerprintHash: string

  @column()
  declare deviceUid: string

  /** `null` sur les lignes antérieures : leur formule pouvait retomber sur le modèle sans le dire. */
  @column()
  declare identity?: DeviceIdentity | null

  /**
   * Reconnaît un même téléphone d'une application à l'autre, là où l'empreinte s'arrête à une app.
   *
   * `null` quand la plateforme n'a rien fourni, ou quand le client est antérieur à ce champ.
   */
  @column()
  declare hardwareKey?: string | null

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
