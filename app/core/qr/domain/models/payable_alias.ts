import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * Alias payable (§4.5) : un code stable → le compte qui reçoit + un nom
 * d'affichage dénormalisé. Aucune relation ORM vers accounts (référence par ID).
 */
export default class PayableAlias extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: string

  @column()
  declare accountId: string

  @column()
  declare displayName: string

  @column()
  declare active: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
