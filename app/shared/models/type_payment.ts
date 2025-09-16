import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import Operator from './operator.js'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class TypePayment extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare libele: string

  @hasMany(() => Operator, {
    foreignKey: 'type_payments_id',
  })
  declare operator: HasMany<typeof Operator>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
