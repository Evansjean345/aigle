import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'
import { KycLevelState } from '#core/identity/kyc/domain/enum/kyc_enum'
import User from '#core/identity/user/domain/models/user'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class KycLevel extends BaseModel {
  static table = 'kyc_level'

  @column({ isPrimary: true })
  declare id: number

  /**
   * Segment du niveau (`particulier` | `marchand` | `enterprise`). Avec `level`, forme la clé
   * `(segment, level)` → limites. Unifie KYC (particulier) et KYB (org).
   */
  @column()
  declare segment: string

  @column()
  declare level: KycLevelState

  // Plafonds : `null` = ILLIMITÉ (ex. enterprise niveau 2), ignoré à la validation.
  @column()
  declare singleLimit: number | null

  @column()
  declare dailyLimit: number | null

  @column()
  declare monthlyLimit: number | null

  @column()
  declare balanceLimit: number | null

  @column()
  declare isActive: boolean

  @column()
  declare isArchived: boolean

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
