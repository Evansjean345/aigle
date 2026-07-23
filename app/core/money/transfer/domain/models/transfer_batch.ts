import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import TransferItem from '#core/money/transfer/domain/models/transfer_item'
import { TransferBatchStatus } from '#core/money/transfer/domain/enums/transfer_batch_status'

/** Lot d'un paiement en masse (mass-transfer). Account-centric : `accountId` = compte source (org). */
export default class TransferBatch extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare reference: string

  @column()
  declare accountId: string

  @column()
  declare initiatedBy: string

  @column()
  declare approvedBy: string | null

  @column()
  declare label: string | null

  @column()
  declare description: string | null

  @column()
  declare totalAmount: number

  @column()
  declare fees: number

  @column()
  declare currency: string

  @column()
  declare expectedCount: number

  @column()
  declare successfulCount: number

  @column()
  declare failedCount: number

  @column()
  declare status: TransferBatchStatus

  @column()
  declare idempotencyKey: string | null

  /** Id de l'écriture ledger de hold (transaction-less, L2-D4). */
  @column()
  declare reservationRef: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => TransferItem, { foreignKey: 'batchId' })
  declare items: HasMany<typeof TransferItem>
}
