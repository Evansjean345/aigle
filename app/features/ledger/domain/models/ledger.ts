import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Transaction from '#features/transactions/domain/models/transaction'
import Wallet from '#features/wallet/domain/models/wallet'
import { LedgerDirection, LedgerOperationType } from '#features/ledger/domain/ledger_enums'

export default class Ledger extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare transactionId: number

  @column()
  declare walletId: number

  @column()
  declare operationType: LedgerOperationType

  @column()
  declare description: string | null

  @column()
  declare direction: LedgerDirection

  @column()
  declare amountBrut: number

  @column()
  declare fees: number

  @column()
  declare totalAmount: number

  @column()
  declare balanceBefore: number

  @column()
  declare balanceAfter: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Transaction, {
    foreignKey: 'transactionId',
  })
  declare transaction: BelongsTo<typeof Transaction>

  @belongsTo(() => Wallet)
  declare wallet: BelongsTo<typeof Wallet>

  static filterByWallet = scope((query, walletId?: number) => {
    if (walletId) {
      query.where('walletId', walletId)
    }
  })

  static filterByDirection = scope((query, direction?: string) => {
    if (direction) {
      query.where('direction', direction)
    }
  })

  static filterByOperationType = scope((query, operationType?: string) => {
    if (operationType) {
      query.where('operationType', operationType)
    }
  })

  static filterByStartDate = scope((query, startDate?: string) => {
    if (startDate) {
      query.where('createdAt', '>=', startDate)
    }
  })

  static filterByEndDate = scope((query, endDate?: string) => {
    if (endDate) {
      query.where('createdAt', '<=', endDate)
    }
  })
}
