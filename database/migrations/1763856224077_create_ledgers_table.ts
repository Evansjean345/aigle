import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ledgers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('transaction_id').unsigned().references('id').inTable('transactions').onDelete('CASCADE')
      table.integer('wallet_id').unsigned().references('id').inTable('wallets').onDelete('CASCADE')
      table.enum('direction', ['DEBIT', 'CREDIT', 'EXTERNAL']).notNullable()
      table.decimal('amount_brut', 19, 4).notNullable()
      table.decimal('fees', 19, 4).notNullable().defaultTo(0)
      table.decimal('total_amount', 19, 4).notNullable()
      table.decimal('balance_after', 19, 4).notNullable()
      table.timestamp('created_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}