import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { KycLevelState } from '#features/kyc/domain/enum/kyc_enum'
import User from '#features/user/domain/models/user'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class KycLevel extends BaseModel {
  static table = 'kyc_level'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare level: KycLevelState

  @column()
  declare singleLimit: number

  @column()
  declare dailyLimit: number

  @column()
  declare monthlyLimit: number

  @column()
  declare balanceLimit: number

  @column()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => User, {
    foreignKey: 'kycLevel',
    localKey: 'level',
  })
  declare users: HasMany<typeof User>
}
