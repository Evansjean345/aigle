import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { CollectionAccountType } from '#aiglebusiness/funding/domain/enums/collection_account_type'

/**
 * Compte de collecte d'Aigle — où un marchand verse pour réapprovisionner son wallet (F1, R-D1).
 *
 * Référentiel de **consultation** : aucun mouvement d'argent ne passe par ici, le versement se fait
 * hors plateforme. Le lien avec la monnaie n'apparaît qu'en F3, quand un gestionnaire valide une
 * demande et crédite le wallet.
 */
export default class CollectionAccount extends BaseModel {
  static table = 'collection_accounts'

  @column({ isPrimary: true })
  declare id: number

  /** Clé stable citée par les demandes de réapprovisionnement. */
  @column()
  declare reference: string

  /** Intitulé vu par le marchand (« Wave Entreprise », « Compte BOA »). */
  @column()
  declare label: string

  @column()
  declare type: CollectionAccountType

  /**
   * Numéro mobile money ou IBAN sur lequel le marchand verse.
   *
   * ⚠️ **Immuable après création** (R-D6) — aucun endpoint ne l'expose en écriture. Le modifier
   * détournerait tous les versements suivants.
   */
  @column()
  declare accountIdentifier: string

  /** Titulaire, que le marchand doit retrouver sur son reçu de versement. */
  @column()
  declare accountHolder: string

  /** Consignes libres (ex. « mentionner la référence de la demande dans le motif »). */
  @column()
  declare instructions: string | null

  /** Visible côté marchand. Désactiver remplace la suppression : l'historique reste lisible. */
  @column()
  declare isActive: boolean

  @column()
  declare displayOrder: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
