import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'refunds'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('refund_uid').notNullable().unique().index()
      // Sans contrainte de clé étrangère : `transactions.id` et `wallets.id` sont des `int
      // unsigned`, et la table les porte en `bigint`. Le lien est tenu par le code.
      table.bigInteger('transaction_id').unsigned().notNullable()
      table.bigInteger('wallet_id').unsigned().notNullable()
      table.enum('type', ['auto_reversal', 'webhook_reversal', 'admin_manual']).notNullable()
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
      table.text('comment', 'mediumtext').notNullable()
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
      table.timestamp('created_at').notNullable().defaultTo(this.now())
      table.timestamp('updated_at').notNullable().defaultTo(this.now())

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
