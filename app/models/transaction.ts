import { DateTime } from 'luxon'
import { BaseModel, beforeSave, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import string from '@adonisjs/core/helpers/string'
import { v4 as uuidv4 } from 'uuid'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import Payment from '#models/payment'
import User from '#models/user'
export default class Transaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @hasMany(() => Payment, {
    foreignKey: 'transactions_id',
  })
  declare payment: HasMany<typeof Payment>

  @belongsTo(() => User, {
    foreignKey: 'users_id',
  })
  declare user: BelongsTo<typeof User>

  @column()
  declare transactions_uid: string

  @column()
  declare users_id: number

  @column()
  declare users_uid: string

  @column()
  declare amount: number

  @column()
  declare total_amount: number

  @column()
  declare operation_type: 'deposit' | 'withdrawal' | 'transfer' | 'transfer-inter'

  @column()
  declare reference: string

  @column()
  declare fees: number

  @column()
  declare balance_before: number | null

  @column()
  declare balance_after: number | null

  @column()
  declare receiver_id: number | null

  @column()
  declare date_transaction: string

  @column()
  declare description: string | null

  @column()
  declare status: 'pending' | 'success' | 'failed'

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeSave()
  static async BaseModel(transaction: Transaction) {
    if (transaction.$isNew) {
      transaction.transactions_uid = uuidv4()
      transaction.reference = 'aigle' + string.random(8)
      transaction.date_transaction = DateTime.now().toFormat('yyyy-MM-dd')
    }
  }
}
