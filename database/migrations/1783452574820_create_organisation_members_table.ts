import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Membres d'organisation. `user_id` (users_uid) et `organisation_id` référencés
 * par valeur (aucune FK vers le core). FK intra-produit `role_id` → organisation_roles.
 */
export default class extends BaseSchema {
  protected tableName = 'organisation_members'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('organisation_id').notNullable().index()
      table.uuid('user_id').notNullable().index()
      table
        .integer('role_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('organisation_roles')
      table.string('status').notNullable().defaultTo('active')
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['organisation_id', 'user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}