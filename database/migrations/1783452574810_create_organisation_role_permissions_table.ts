import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rattachement permission (slug du catalogue code) → rôle d'organisation.
 * FK intra-produit vers organisation_roles (ON DELETE CASCADE).
 */
export default class extends BaseSchema {
  protected tableName = 'organisation_role_permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organisation_roles')
        .onDelete('CASCADE')
      table.string('permission_slug').notNullable()
      table.timestamp('created_at')

      table.unique(['role_id', 'permission_slug'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
