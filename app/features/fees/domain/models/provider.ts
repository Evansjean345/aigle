import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import ServiceProviderMethod from './service_provider_method.js'

export type ProviderType = 'mobile_money' | 'bank' | 'credit-card'

export default class Provider extends BaseModel {
  public static table = 'providers'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare name: string

  @column()
  declare type: ProviderType

  @column()
  declare logo?: string | null

  @hasMany(() => ServiceProviderMethod, {
    foreignKey: 'providerFromId',
  })
  declare outgoingMethods: HasMany<typeof ServiceProviderMethod>

  @hasMany(() => ServiceProviderMethod, {
    foreignKey: 'providerToId',
  })
  declare incomingMethods: HasMany<typeof ServiceProviderMethod>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
