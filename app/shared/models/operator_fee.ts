import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class OperatorFee extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare operator_type: string

  @column()
  declare operators_id: number

  @column()
  declare services_id: number

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
