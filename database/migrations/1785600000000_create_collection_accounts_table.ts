import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Catalogue des comptes de collecte : les comptes d'Aigle sur lesquels les marchands versent.
 *
 * `account_identifier` n'est modifiable par aucun endpoint : changer de compte suppose de désactiver
 * celui-ci et d'en créer un nouveau. Pas de suppression non plus, les demandes le référencent.
 */
export default class extends BaseSchema {
  protected tableName = 'collection_accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      // Clé stable citée par les demandes (plutôt que l'id auto-incrémenté).
      table.string('reference').notNullable().unique()

      table.string('label').notNullable()
      table.string('type').notNullable().index() // mobile_money | bank

      // Le numéro/IBAN sur lequel le marchand verse — unique pour éviter deux entrées identiques
      // entre lesquelles il devrait choisir.
      table.string('account_identifier').notNullable().unique()
      table.string('account_holder').notNullable()

      table.text('instructions').nullable()

      table.boolean('is_active').notNullable().defaultTo(true).index()
      table.integer('display_order').notNullable().defaultTo(0)

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
