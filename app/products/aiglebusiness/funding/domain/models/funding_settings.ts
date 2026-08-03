import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * Réglages du réapprovisionnement. Une seule ligne existe en base.
 */
export default class FundingSettings extends BaseModel {
  static table = 'funding_settings'

  @column({ isPrimary: true })
  declare id: number

  /** Au-delà de ce montant déclaré, une demande exige deux valideurs distincts. */
  @column()
  declare doubleApprovalThreshold: number

  /** Dernier gestionnaire à avoir modifié le seuil. */
  @column()
  declare updatedByAdminId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
