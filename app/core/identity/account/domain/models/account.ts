import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { AccountOwnerType } from '#core/identity/account/domain/enums/account_owner_type'
import { AccountSegment } from '#core/identity/account/domain/enums/account_segment'
import { AccountStatus } from '#core/identity/account/domain/enums/account_status'
import { VerificationProfile } from '#core/identity/kyc/domain/verification_profile'

/**
 * Compte — pivot d'appartenance entre un propriétaire (user ou organisation) et son wallet.
 * `accountId` est la clé référencée par le wallet et les transactions (dérivée aujourd'hui
 * = ownerRef, portée en colonne propre).
 *
 * Le compte vit dans **identity** (refactor account-centric, β) : c'est un concept de
 * **vérification** — il porte le **segment** et le **niveau** (unifie KYC user + KYB org) qui
 * résolvent ses limites (`kyc_level`). Le **gel argent** reste sur le wallet (`WalletStatus`) ;
 * le **statut party** reste `user.status` / `org.status`.
 *
 * Aucune FK vers `users` / `organisations` : le compte ne connaît qu'un `ownerRef` (string) —
 * indépendance des contextes.
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

  @column()
  declare segment: AccountSegment | null

  /**
   * Jeu de pièces attendu du compte.
   *
   * Nul pour un compte antérieur à la colonne : les lecteurs se replient alors sur `IDENTITE`.
   */
  @column()
  declare verificationProfile: VerificationProfile | null

  @column()
  declare level: number | null

  @column()
  declare status: AccountStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
