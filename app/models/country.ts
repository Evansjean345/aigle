import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Country extends BaseModel {
  static table = 'countries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare flag: string

  @column()
  declare iso_code: string

  @column()
  declare currency_code: string

  @column()
  declare currency_symbol: string

  @column()
  declare phone_code: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
