import { BaseModel, column } from '@adonisjs/lucid/orm'
import { DateTime } from 'luxon'

export default class KycLevel extends BaseModel {
  static table = 'kyc_level'

  @column({ isPrimary: true })
  declare id: number

  /**
   * Segment du niveau (`particulier` | `organisation`). Avec `level`, forme la clé
   * `(segment, level)` → limites.
   */
  @column()
  declare segment: string

  /**
   * Rang du palier dans son segment.
   *
   * Un entier libre et non `KycLevelState` : la grille porte un niveau 0 — organisation dont le
   * dossier n'est pas approuvé — que cet enum ne sait pas représenter.
   */
  @column()
  declare level: number

  // Plafonds : `null` = ILLIMITÉ (ex. organisation niveau 2), ignoré à la validation.
  @column()
  declare singleLimit: number | null

  @column()
  declare dailyLimit: number | null

  @column()
  declare monthlyLimit: number | null

  @column()
  declare balanceLimit: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
