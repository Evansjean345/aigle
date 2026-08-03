import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Admin from '#core/team/domain/models/admin'
import {
  RefundReason,
  RefundStatus,
  RefundType,
} from '#core/money/transactions/domain/enums/refund'

export default class Refund extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare refundUid: string

  @column()
  declare transactionId: number

  @column()
  declare walletId: number

  @column()
  declare type: RefundType

  @column()
  declare reason: RefundReason

  @column()
  declare status: RefundStatus

  @column()
  declare amount: number

  @column()
  declare feesRefunded: number

  @column()
  declare totalRefunded: number

  @column()
  declare comment: string

  @column()
  declare adminId: number | null

  @column()
  declare balanceBefore: number

  @column()
  declare balanceAfter: number

  @column.dateTime()
  declare executedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Transaction)
  declare transaction: BelongsTo<typeof Transaction>

  @belongsTo(() => Admin, { foreignKey: 'adminId' })
  declare admin: BelongsTo<typeof Admin>

  @beforeCreate()
  static assignUid(refund: Refund) {
    refund.refundUid = uuidv4()
  }
}
