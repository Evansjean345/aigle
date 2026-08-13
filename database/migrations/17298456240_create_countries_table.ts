import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Table des pays.
 *
 * Reprise de la structure telle qu'elle existe en base : la version d'origine était commentée, et
 * la table avait été créée hors migration. Aucun environnement neuf ne pouvait donc être
 * provisionné — la migration suivante pose une clé étrangère vers elle.
 */
export default class extends BaseSchema {
  protected tableName = 'countries'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('iso_three', 3).notNullable().unique('iso3')
      table.string('iso_two', 2).notNullable().unique('iso2')
      table.string('numeric_code', 3).nullable().unique('numeric_code')
      table.string('flag', 10).nullable()
      table.string('status').defaultTo('active')
      table.string('currency').defaultTo('XOF')
      table.string('phone_code').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
