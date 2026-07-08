import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { MemberStatus } from '#aiglebusiness/membership/domain/enums/member_status'

/**
 * Membre d'une organisation : un user Aigle rattaché à une org avec un rôle.
 * Le user opère le compte de l'org via son rôle (pas de nouveau compte).
 * Entité produit : `userId` (users_uid) référencé par valeur, aucune FK vers le core.
 */
export default class OrganisationMember extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare organisationId: string

  @column()
  declare userId: string

  @column()
  declare roleId: number

  @column()
  declare status: MemberStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}