import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Transaction from '#features/transactions/domain/models/transaction'
import Wallet from '#features/wallet/domain/models/wallet'
import { LedgerDirection } from '#features/ledger/domain/ledger_enums'

export default class Ledger extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare transactionId: number

  @column()
  declare walletId: number

  @column()
  declare direction: LedgerDirection

  @column()
  declare amountBrut: number

  @column()
  declare fees: number

  @column()
  declare totalAmount: number

  @column()
  declare balanceAfter: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Transaction)
  declare transaction: BelongsTo<typeof Transaction>

  @belongsTo(() => Wallet)
  declare wallet: BelongsTo<typeof Wallet>
}
