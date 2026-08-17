import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rôles d'organisation (RBAC business, produit aiglebusiness). Aucune FK vers le
 * core : `organisation_id` référencé par valeur.
 */
export default class extends BaseSchema {
  protected tableName = 'organisation_roles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('organisation_id').notNullable().index()
      table.string('slug').notNullable()
      table.string('name').notNullable()
      table.boolean('is_system').notNullable().defaultTo(false)
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['organisation_id', 'slug'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
