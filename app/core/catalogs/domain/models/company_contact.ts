import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export type ContactType = 'phone' | 'whatsapp' | 'email'

export default class CompanyContact extends BaseModel {
  public static table = 'company_contacts'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare type: ContactType

  @column()
  declare value: string

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
