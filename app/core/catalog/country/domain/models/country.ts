import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Country extends BaseModel {
  static table = 'countries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare isoThree: string

  @column()
  declare isoTwo: string

  @column()
  declare numericCode: string

  @column()
  declare phoneCode: string

  @column()
  declare currency: string

  @column()
  declare flag: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
