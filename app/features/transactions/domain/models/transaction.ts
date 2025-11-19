import { DateTime } from 'luxon'
import { BaseModel, beforeSave, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import string from '@adonisjs/core/helpers/string'
import { v4 as uuidv4 } from 'uuid'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Payment from '#features/transactions/domain/models/payment'
import User from '#features/authentication/domain/models/user'

export type TransactionType = 'deposit' | 'wallet_transfert' | 'transfer' | 'transfer-inter'
export type TransactionStatus = 'pending' | 'success' | 'failed'
export type TransactionDirection = 'debit' | 'credit' | 'external'

export default class Transaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @hasMany(() => Payment, {
    foreignKey: 'transactionsId',
  })
  declare payment: HasMany<typeof Payment>

  @belongsTo(() => User, {
    foreignKey: 'usersId',
  })
  declare user: BelongsTo<typeof User>

  @column()
  declare transactionsId: number

  @column()
  declare transactionsUid: string

  @column()
  declare usersId: number

  @column()
  declare usersUid: string

  @column()
  declare amount: number

  @column()
  declare totalAmount: number

  @column()
  declare operationType: TransactionType

  @column()
  declare direction: TransactionDirection

  @column()
  declare reference: string

  @column()
  declare fees: number

  @column()
  declare balanceBefore: number | null

  @column()
  declare balanceAfter: number | null

  @column()
  declare receiverId: number | null

  @column()
  declare dateTransaction: string

  @column()
  declare description: string | null

  @column()
  declare status: TransactionStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @beforeSave()
  static async BaseModel(transaction: Transaction) {
    if (transaction.$isNew) {
      transaction.transactionsUid = uuidv4()
      transaction.reference = 'aigle' + string.random(8)
      transaction.dateTransaction = DateTime.now().toFormat('yyyy-MM-dd')
    }
  }
}
