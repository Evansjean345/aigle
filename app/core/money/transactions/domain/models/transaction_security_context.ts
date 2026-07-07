import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Transaction from '#core/money/transactions/domain/models/transaction'
import Device from '#core/device/domain/models/device'

export default class TransactionSecurityContext extends BaseModel {
  public static table = 'transaction_security_contexts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare transactionId: number

  @column()
  declare deviceId: string | null

  @column()
  declare fingerprintHash: string | null

  @column()
  declare ipAddress: string

  @column()
  declare userAgent: string | null

  @column()
  declare osVersion: string | null

  @column()
  declare appVersion: string | null

  @column()
  declare countryCode: string | null

  @column()
  declare city: string | null

  @column()
  declare isVpn: boolean

  @column()
  declare riskScore: number | null

  @column.dateTime({ autoCreate: true })
  declare capturedAt: DateTime

  @belongsTo(() => Transaction)
  declare transaction: BelongsTo<typeof Transaction>

  @belongsTo(() => Device, {
    foreignKey: 'deviceId',
    localKey: 'deviceUid',
  })
  declare device: BelongsTo<typeof Device>
}
