import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'wallets'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('wallets_uid').index()
      table
        .uuid('user_id')
        .notNullable()
        .references('users_uid')
        .inTable('users')
        .onDelete('cascade')
        .onUpdate('cascade')

      table.decimal('balance', 15, 2).defaultTo(0)
      table.string('status').defaultTo('active')
      table.string('currency_symbol').defaultTo('XOF')
      /** Jeton du QR de réception, distinct de l'identifiant du portefeuille. */
      table.string('qrcode_token', 64).nullable().unique()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
