import { DateTime } from 'luxon'
import { BaseModel, beforeSave, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from '#shared/models/user'

export default class Wallet extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare walletsUid: string

  @column()
  declare userId: string

  @column()
  declare balance: number

  @column()
  declare currencySymbol?: string

  @column()
  declare qrcodeToken: string

  @column()
  declare status: 'active' | 'inactive' | 'pending' | 'suspended'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User, {
    foreignKey: 'userId',
    localKey: 'usersUid',
  })
  declare user: BelongsTo<typeof User>

  @beforeSave()
  static async BaseModel(wallet: Wallet) {
    wallet.walletsUid = uuidv4()
  }
}
