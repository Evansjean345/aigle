import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * Rattachement d'une permission (slug du catalogue code) à un rôle d'organisation.
 */
export default class OrganisationRolePermission extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare roleId: number

  @column()
  declare permissionSlug: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime
}