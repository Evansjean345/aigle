import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'refunds'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('refund_uid').notNullable().unique().index()
      table
        .integer('transaction_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('transactions')
        .onDelete('CASCADE')
      table
        .integer('wallet_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('wallets')
        .onDelete('CASCADE')
      table.enum('type', ['auto_reverse', 'webhook_reverse', 'admin_manual']).notNullable()
      table
        .enum('reason', [
          'operator_failure',
          'dispute',
          'operator_error',
          'customer_complaint',
          'reconciliation_gap',
          'other',
        ])
        .notNullable()
      table.enum('status', ['executed']).notNullable().defaultTo('executed')
      table.decimal('amount', 15, 4).notNullable()
      table.decimal('fees_refunded', 15, 4).notNullable().defaultTo(0)
      table.decimal('total_refunded', 15, 4).notNullable()
      table.text('comment').notNullable()
      table
        .integer('admin_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('admins')
        .onDelete('SET NULL')
      table.decimal('balance_before', 15, 4).notNullable()
      table.decimal('balance_after', 15, 4).notNullable()

      table.timestamp('executed_at').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.index(['transaction_id'])
      table.index(['wallet_id'])
      table.index(['type'])
      table.index(['admin_id'])
      table.index(['executed_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
