import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { CollectionAccountType } from '#aiglebusiness/funding/domain/enums/collection_account_type'

/**
 * Compte sur lequel un marchand verse pour réapprovisionner le wallet de son organisation.
 *
 * Référentiel de consultation : aucun mouvement d'argent ne passe par ici, le versement se fait
 * hors plateforme.
 */
export default class CollectionAccount extends BaseModel {
  static table = 'collection_accounts'

  @column({ isPrimary: true })
  declare id: number

  /** Référence publique, citée par les demandes de réapprovisionnement. */
  @column()
  declare reference: string

  /** Intitulé affiché au marchand, par exemple « Wave Entreprise ». */
  @column()
  declare label: string

  @column()
  declare type: CollectionAccountType

  /**
   * Numéro mobile money, RIB ou IBAN sur lequel le marchand verse.
   *
   * Immuable après création : aucun endpoint ne l'expose en écriture. Changer de compte suppose de
   * désactiver celui-ci et d'en créer un nouveau.
   */
  @column()
  declare accountIdentifier: string

  /** Titulaire du compte, à retrouver sur le reçu de versement. */
  @column()
  declare accountHolder: string

  /** Consignes de versement libres, saisies par l'administrateur. */
  @column()
  declare instructions: string | null

  /**
   * Visibilité côté marchand. La désactivation remplace la suppression.
   *
   * 'consume` convertit le `tinyint(1)` MySQL en booléen : sans lui, un consommateur comparant avec
   * `=== true` lirait « inactif » sur un compte actif.
   */
  @column({ consume: (value) => Boolean(value) })
  declare isActive: boolean

  @column()
  declare displayOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
