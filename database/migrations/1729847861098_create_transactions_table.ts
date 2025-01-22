import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('transactions_uid').index()
      table.string('reference').index()

      table
        .integer('users_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('cascade')
        .onUpdate('cascade')

      table
        .uuid('users_uid')
        .notNullable()
        .references('users_uid')
        .inTable('users')
        .onDelete('cascade')
        .onUpdate('cascade')

      table.decimal('fees', 15, 2).notNullable()
      table.decimal('amount', 15, 2).notNullable()
      table.decimal('total_amount', 15, 2).notNullable()
      table.decimal('balance_before', 15, 2).nullable()
      table.decimal('balance_after', 15, 2).nullable()

      table.string('operation_type').nullable()
      table.date('date_transaction').nullable()
      table.text('description').nullable()
      table.string('status').notNullable().defaultTo('pending')

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
