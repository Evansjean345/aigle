import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ServiceProviderMethod from '#features/catalogs/domain/models/service_provider_method'

export default class PaymentMethod extends BaseModel {
  public static table = 'payment_methods'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare label: string

  @column()
  declare order: number

  @hasMany(() => ServiceProviderMethod, {
    foreignKey: 'paymentMethodId',
  })
  declare methods: HasMany<typeof ServiceProviderMethod>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
