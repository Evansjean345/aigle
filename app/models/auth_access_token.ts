import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class AuthAccessToken extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare tokenable_id: number

  @column()
  declare deviceInfo: string | null

  @column()
  declare type: string | null

  @column()
  declare name: string | null

  @column()
  declare hash: string | null

  @column()
  declare abilities: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
