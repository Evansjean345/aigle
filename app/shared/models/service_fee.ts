import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class ServiceFee extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare services_id: string

  @column()
  declare services_type: string

  @column()
  declare min_amount: number

  @column()
  declare max_amount: number

  @column()
  declare fixed_fee: number

  @column()
  declare percentage_fee: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
