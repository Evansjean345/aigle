import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import TransferBatch from '#core/money/transfer/domain/models/transfer_batch'
import { TransferItemStatus } from '#core/money/transfer/domain/enums/transfer_item_status'

/**
 * Bénéficiaire d'un lot = unité d'exécution ET outbox (L2). `idempotencyKey = batchId:sequence`.
 * `transactionReference` référence la transaction core (source comptable).
 */
export default class TransferItem extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare batchId: number

  @column()
  declare idempotencyKey: string

  @column()
  declare sequence: number

  @column()
  declare amount: number

  @column()
  declare fees: number

  @column()
  declare currency: string

  @column()
  declare recipientName: string | null

  @column()
  declare recipientPhone: string

  @column()
  declare operator: string

  @column()
  declare country: string

  @column()
  declare status: TransferItemStatus

  @column()
  declare transactionReference: string | null

  @column()
  declare providerReference: string | null

  @column()
  declare failureReason: string | null

  @column()
  declare attempts: number

  @column.dateTime()
  declare nextRetryAt: DateTime | null

  @column.dateTime()
  declare settledAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => TransferBatch, { foreignKey: 'batchId' })
  declare batch: BelongsTo<typeof TransferBatch>
}
