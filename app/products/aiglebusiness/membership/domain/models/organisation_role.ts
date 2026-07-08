import { DateTime } from 'luxon'
import { BaseModel, column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import OrganisationRolePermission from '#aiglebusiness/membership/domain/models/organisation_role_permission'

/**
 * Rôle d'une organisation (RBAC business). Compose des permissions du catalogue
 * (via organisation_role_permissions). `isSystem` marque les rôles seedés (OWNER)
 * — non supprimables. Entité produit : aucune relation vers le core.
 */
export default class OrganisationRole extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare organisationId: string

  @column()
  declare slug: string

  @column()
  declare name: string

  // MySQL stocke les booléens en tinyint(1) → cast explicite DB→boolean.
  @column({ consume: (value) => Boolean(value) })
  declare isSystem: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => OrganisationRolePermission, { foreignKey: 'roleId' })
  declare permissions: HasMany<typeof OrganisationRolePermission>
}
