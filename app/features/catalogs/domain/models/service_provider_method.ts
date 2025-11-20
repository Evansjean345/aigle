import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import ServiceType from '#features/catalogs/domain/models/service_type'
import PaymentMethod from '#features/catalogs/domain/models/payment_method'
import Provider from '#features/catalogs/domain/models/provider'

export default class ServiceProviderMethod extends BaseModel {
  public static table = 'service_provider_methods'

  @column({ isPrimary: true })
  declare id: number

  @column({ columnName: 'service_type_id' })
  declare serviceTypeId: number

  @column({ columnName: 'payment_method_id' })
  declare paymentMethodId: number

  @column({ columnName: 'provider_from_id' })
  declare providerFromId: number

  @column({ columnName: 'provider_to_id' })
  declare providerToId?: number | null

  @column({ columnName: 'fee_fixed' })
  declare feeFixed: bigint | number

  @column({ columnName: 'fee_percent' })
  declare feePercent: number

  @column({ columnName: 'min_amount' })
  declare minAmount: number

  @column()
  declare applyFees: boolean

  @column()
  declare currency: string

  @column({ columnName: 'is_active' })
  declare isActive: boolean

  @belongsTo(() => ServiceType, {
    foreignKey: 'serviceTypeId',
  })
  declare serviceType: BelongsTo<typeof ServiceType>

  @belongsTo(() => PaymentMethod, {
    foreignKey: 'paymentMethodId',
  })
  declare paymentMethod: BelongsTo<typeof PaymentMethod>

  @belongsTo(() => Provider, {
    foreignKey: 'providerFromId',
  })
  declare providerFrom: BelongsTo<typeof Provider>

  @belongsTo(() => Provider, {
    foreignKey: 'providerToId',
  })
  declare providerTo: BelongsTo<typeof Provider>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
