import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { AccountOwnerType } from '#core/money/account/domain/enums/account_owner_type'

/**
 * Compte money — pivot d'appartenance entre un propriétaire (user ou
 * organisation) et son wallet. `accountId` est la clé référencée par le wallet ;
 * dérivée aujourd'hui (= ownerRef), volontairement portée en colonne propre.
 *
 * Aucune FK vers `users` : le compte ne connaît qu'un `ownerRef` (string), ce qui
 * garde le contexte money indépendant du contexte identity.
 */
export default class Account extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare accountId: string

  @column()
  declare ownerType: AccountOwnerType

  @column()
  declare ownerRef: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
