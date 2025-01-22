import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class MobileMoneyDetail extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare payments_id: number

  @column()
  declare payments_uid: string

  @column()
  declare pincode: string

  @column()
  declare url_operator: string

  @column()
  declare debiteur_phone: string

  @column()
  declare beneficiaire_name: string | null

  @column()
  declare beneficiaire_phone: string | null

  @column()
  declare operator: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
