import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ledgers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('transaction_id')
        .unsigned()
        .references('id')
        .inTable('transactions')
        .onDelete('CASCADE')
      table.integer('wallet_id').unsigned().references('id').inTable('wallets').onDelete('CASCADE')
      table.enum('direction', ['DEBIT', 'CREDIT', 'EXTERNAL']).notNullable()
      // Deux décimales : le franc CFA n'a pas de subdivision, et c'est la précision que porte le
      // grand livre en production.
      table.decimal('amount_brut', 19, 2).notNullable()
      table.decimal('fees', 19, 2).notNullable().defaultTo(0)
      table.decimal('total_amount', 19, 2).notNullable()
      table.decimal('balance_after', 19, 2).notNullable()
      table.timestamp('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
