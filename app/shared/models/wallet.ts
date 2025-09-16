import { DateTime } from 'luxon'
import { BaseModel, beforeSave, belongsTo, column, hasOne } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasOne } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'

export default class Wallet extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare wallets_uid: string

  @column()
  declare users_id: number

  @belongsTo(() => User, {
    foreignKey: 'id',
  })
  declare user: BelongsTo<typeof User>

  @column()
  declare users_uid: string

  @column()
  declare balance: number

  @column()
  declare status: 'active' | 'inactive' | string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeSave()
  static async BaseModel(wallet: Wallet) {
    wallet.wallets_uid = uuidv4()
  }
}
