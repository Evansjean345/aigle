import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'wallet_adjustments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.string('adjustment_uid', 36).notNullable().unique()

      table
        .bigInteger('wallet_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('wallets')
        .onDelete('CASCADE')

      table
        .bigInteger('transaction_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('transactions')
        .onDelete('SET NULL')

      table.enum('type', ['credit', 'debit']).notNullable()

      table
        .enum('reason', [
          'missing_debit',
          'duplicate_credit',
          'duplicate_debit',
          'reconciliation_gap',
          'system_error',
          'other',
        ])
        .notNullable()

      table.enum('status', ['executed']).notNullable().defaultTo('executed')

      table.decimal('amount', 15, 4).notNullable()
      table.decimal('balance_before', 15, 4).notNullable()
      table.decimal('balance_after', 15, 4).notNullable()
      table.text('comment').notNullable()
      table.integer('admin_id').unsigned().notNullable()
      table.decimal('max_amount', 15, 4).nullable()
      table.timestamp('executed_at').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['wallet_id'], 'idx_adjustments_wallet_id')
      table.index(['transaction_id'], 'idx_adjustments_transaction_id')
      table.index(['type'], 'idx_adjustments_type')
      table.index(['reason'], 'idx_adjustments_reason')
      table.index(['admin_id'], 'idx_adjustments_admin_id')
      table.index(['executed_at'], 'idx_adjustments_executed_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
