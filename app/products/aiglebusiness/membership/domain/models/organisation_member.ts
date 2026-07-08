import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import OrganisationRole from '#aiglebusiness/membership/domain/models/organisation_role'
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

  @column()
  declare invitationToken: string | null

  @column.dateTime()
  declare invitationExpiresAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => OrganisationRole, { foreignKey: 'roleId' })
  declare role: BelongsTo<typeof OrganisationRole>
}
