import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { v4 as uuidv4 } from 'uuid'
import Wallet from '#core/wallet/domain/models/wallet'
import Transaction from '#core/transactions/domain/models/transaction'
import Admin from '#core/team/domain/models/admin'
import {
  AdjustmentType,
  AdjustmentReason,
  AdjustmentStatus,
} from '#core/wallet/domain/enums/wallet_adjustment'

export default class WalletAdjustment extends BaseModel {
  static table = 'wallet_adjustments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare adjustmentUid: string

  @column()
  declare walletId: number

  @column()
  declare transactionId: number | null

  @column()
  declare type: AdjustmentType

  @column()
  declare reason: AdjustmentReason

  @column()
  declare status: AdjustmentStatus

  @column()
  declare amount: number

  @column()
  declare balanceBefore: number

  @column()
  declare balanceAfter: number

  @column()
  declare comment: string

  @column()
  declare adminId: number

  @column()
  declare maxAmount: number | null

  @column.dateTime()
  declare executedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Wallet)
  declare wallet: BelongsTo<typeof Wallet>

  @belongsTo(() => Transaction)
  declare transaction: BelongsTo<typeof Transaction>

  @belongsTo(() => Admin, { foreignKey: 'adminId' })
  declare admin: BelongsTo<typeof Admin>

  @beforeCreate()
  static generateUid(adjustment: WalletAdjustment) {
    adjustment.adjustmentUid = uuidv4()
  }
}
