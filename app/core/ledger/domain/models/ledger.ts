import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, scope } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Transaction from '#core/transactions/domain/models/transaction'
import Wallet from '#core/wallet/domain/models/wallet'
import { LedgerDirection, LedgerOperationType } from '#core/ledger/domain/ledger_enums'

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
      query.where('wallet_id', walletId)
    }
  })

  static filterByDirection = scope((query, direction?: string) => {
    if (direction) {
      query.where('direction', direction)
    }
  })

  static filterByOperationType = scope((query, operationType?: string) => {
    if (operationType) {
      query.where('operation_type', operationType)
    }
  })

  static filterByUser = scope((query, userId?: string) => {
    if (userId) {
      query.whereHas('wallet', (walletQuery) => {
        walletQuery.where('userId', userId)
      })
    }
  })

  static filterByDateRange = scope((query, startDate?: string, endDate?: string) => {
    if (startDate && endDate) {
      query
        .where('created_at', '>=', `${startDate} 00:00:00`)
        .andWhere('created_at', '<=', `${endDate} 23:59:59`)
    } else if (startDate) {
      query
        .where('created_at', '>=', `${startDate} 00:00:00`)
        .andWhere('created_at', '<=', `${startDate} 23:59:59`)
    }
  })

  static search = scope((query, searchTerm: string) => {
    query.where((subQuery) => {
      subQuery
        .orWhereHas("transaction", (transactionQuery) => {
          transactionQuery.where('reference', 'like', `%${searchTerm}%`)
        })
        .orWhereHas('wallet', (walletQuery) => {
          walletQuery.whereHas('user', (userQuery) => {
            userQuery
              .where('firstname', 'like', `%${searchTerm}%`)
              .orWhere('lastname', 'like', `%${searchTerm}%`)
          })
        })

      const amount = Number.parseFloat(searchTerm)

      if (!Number.isNaN(amount)) {
        subQuery.orWhere('total_amount', amount)
      }
    })
  })
}
