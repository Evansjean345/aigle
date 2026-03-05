import { DateTime } from 'luxon'
import {
  BaseModel,
  beforeSave,
  belongsTo,
  column,
  hasMany,
  hasOne,
  scope,
} from '@adonisjs/lucid/orm'
import string from '@adonisjs/core/helpers/string'
import { v4 as uuidv4 } from 'uuid'
import type { BelongsTo, HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import Payment from '#features/transactions/domain/models/payment'
import TransactionSecurityContext from '#features/transactions/domain/models/transaction_security_context'
import User from '#features/users/domain/models/user'
import Ledger from '#features/ledger/domain/models/ledger'
import { TransactionType } from '#features/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#features/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#features/transactions/domain/enums/transaction_direction'
import db from '@adonisjs/lucid/services/db'

export default class Transaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

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
  declare idempotency: string | null

  @column()
  declare fees: number

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

  @hasMany(() => Payment, {
    foreignKey: 'transactionsId',
  })
  declare payment: HasMany<typeof Payment>

  @hasOne(() => Ledger, {
    foreignKey: 'transactionId',
  })
  declare ledger: HasOne<typeof Ledger>

  @hasOne(() => TransactionSecurityContext, {
    foreignKey: 'transactionId',
  })
  declare securityContext: HasOne<typeof TransactionSecurityContext>

  @belongsTo(() => User, {
    foreignKey: 'usersId',
  })
  declare user: BelongsTo<typeof User>

  static filterByType = scope((query, type: TransactionType) => {
    query.where('operation_type', type)
  })

  static filterByStatus = scope((query, status: TransactionStatus) => {
    query.where('status', status)
  })

  static search = scope((query, searchTerm: string) => {
    query.where((subQuery) => {
      subQuery
        .where('reference', 'like', `%${searchTerm}%`)
        .orWhere('operation_type', 'like', `%${searchTerm}%`)
        .orWhereHas('user', (userQuery) => {
          userQuery
            .where('firstname', 'like', `%${searchTerm}%`)
            .orWhere('lastname', 'like', `%${searchTerm}%`)
        })

      const amount = Number.parseFloat(searchTerm)

      if (!Number.isNaN(amount)) {
        subQuery.orWhere('amount', amount)
      }
    })
  })

  static filterByDateRange = scope((query, startDate?: string, endDate?: string) => {
    if (startDate && endDate) {
      query
        .where('created_at', '>=', `${startDate} 00:00:00`)
        .andWhere('created_at', '<=', `${endDate} 23:59:59`)
    } else if (startDate) {
      query.where(db.raw('DATE(created_at)'), `${startDate}`)
    }
  })

  @beforeSave()
  static async BaseModel(transaction: Transaction) {
    if (transaction.$isNew) {
      transaction.transactionsUid = uuidv4()

      if (!transaction.reference) {
        transaction.reference = 'aigle_' + string.random(8)
      }

      transaction.dateTransaction = DateTime.now().toFormat('yyyy-MM-dd')
    }
  }
}
