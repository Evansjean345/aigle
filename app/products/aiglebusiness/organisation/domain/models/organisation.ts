import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { OrganisationAccountType } from '#aiglebusiness/organisation/domain/enums/organisation_account_type'
import { OrganisationLevel } from '#aiglebusiness/organisation/domain/enums/organisation_level'
import { OrganisationStatus } from '#aiglebusiness/organisation/domain/enums/organisation_status'

/**
 * Organisation business. Entité PRODUIT : aucune relation ORM vers le core.
 * Le compte money de l'org est atteint via `account_id = organisationId`
 * (dérivé), résolu côté core sans jointure.
 */
export default class Organisation extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare organisationId: string

  @column()
  declare ownerUserId: string

  @column()
  declare name: string

  @column()
  declare accountType: OrganisationAccountType

  /**
   * Palier de l'organisation, **projection** de `accounts.level`.
   *
   * Ne décide de rien : la validation des mouvements lit le compte. Sert l'affichage et le filtre
   * de la liste admin, qui pagine et ne peut donc pas interroger le compte ligne à ligne.
   *
   * Écrite par le provisioning et par la décision de revue. Un désalignement est relevé par
   * `diagnose()` et réparé par la reprise.
   */
  @column()
  declare level: OrganisationLevel

  @column()
  declare status: OrganisationStatus

  @column()
  declare payableCode: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
