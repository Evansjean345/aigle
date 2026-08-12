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

  /**
   * Dernier gestionnaire à avoir modifié le seuil.
   *
   * Conservé en base mais absent de la réponse HTTP : c'est le journal d'audit qui restitue qui a
   * modifié quoi, et le dupliquer ici donnerait une seconde version à tenir à jour.
   */
  @column()
  declare updatedByAdminId: number | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
