import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ServiceProviderMethod from '#core/catalog/catalogs/domain/models/service_provider_method'

export default class ServiceType extends BaseModel {
  public static table = 'service_types'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare label: string

  @column()
  declare description?: string | null

  @hasMany(() => ServiceProviderMethod, {
    foreignKey: 'serviceTypeId',
  })
  declare methods: HasMany<typeof ServiceProviderMethod>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
