import { DateTime } from 'luxon'
import { BaseModel, beforeSave, column, hasMany, hasOne, scope } from '@adonisjs/lucid/orm'
import string from '@adonisjs/core/helpers/string'
import { v4 as uuidv4 } from 'uuid'
import type { HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import Payment from '#core/money/transactions/domain/models/payment'
import TransactionLogEntry from '#core/money/transactions/domain/models/transaction_log_entry'
import TransactionSecurityContext from '#core/money/transactions/domain/models/transaction_security_context'
import Ledger from '#core/money/ledger/domain/models/ledger'
import Refund from '#core/money/transactions/domain/models/refund'
import { TransactionType } from '#core/money/transactions/domain/enums/transaction_type'
import { TransactionStatus } from '#core/money/transactions/domain/enums/transaction_status'
import { TransactionDirection } from '#core/money/transactions/domain/enums/transaction_direction'
import db from '@adonisjs/lucid/services/db'

export default class Transaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare transactionsUid: string

  /**
   * Porteur utilisateur, hérité. Nul pour une transaction d'organisation — le titulaire se lit sur
   * `accountId`.
   */
  @column()
  declare usersUid: string

  @column()
  declare accountId: string

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

  @hasMany(() => Ledger, {
    foreignKey: 'transactionId',
  })
  declare ledgers: HasMany<typeof Ledger>

  @hasOne(() => Refund, {
    foreignKey: 'transactionId',
  })
  declare refund: HasOne<typeof Refund>

  @hasMany(() => TransactionLogEntry, {
    foreignKey: 'transactionId',
    localKey: 'reference',
  })
  declare logs: HasMany<typeof TransactionLogEntry>
  @hasOne(() => TransactionSecurityContext, {
    foreignKey: 'transactionId',
  })
  declare securityContext: HasOne<typeof TransactionSecurityContext>

  static filterByType = scope((query, type: TransactionType) => {
    query.where('operation_type', type)
  })

  static filterByStatus = scope((query, status: TransactionStatus) => {
    query.where('status', status)
  })

  /**
   * Restreint aux transactions dont la référence, le type, le montant ou le titulaire correspond.
   *
   * Le titulaire arrive résolu en comptes : une transaction d'organisation n'a pas de porteur
   * utilisateur, et joindre `user` la rendrait introuvable.
   */
  static search = scope((query, searchTerm: string, accountIds: string[] = []) => {
    query.where((subQuery) => {
      subQuery
        .whereILike('reference', `%${searchTerm}%`)
        .orWhereILike('operation_type', `%${searchTerm}%`)

      if (accountIds.length > 0) {
        subQuery.orWhereIn('account_id', accountIds)
      }

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
