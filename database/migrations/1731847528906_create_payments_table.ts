import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('payments_uid').index()
      table.string('reference').index()

      table
        .integer('transactions_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('transactions')
        .onDelete('cascade')
        .onUpdate('cascade')

      table
        .uuid('transactions_uid')
        .notNullable()
        .references('transactions_uid')
        .inTable('transactions')
        .onDelete('cascade')
        .onUpdate('cascade')

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

      table
        .integer('receiver_id')
        .nullable()
        .unsigned()
        .references('id')
        .inTable('receivers')
        .onDelete('set null')
        .onUpdate('set null')

      table.string('step').nullable()
      table.string('status').notNullable().defaultTo('pending')

      table.decimal('fees', 15, 2).notNullable()
      table.decimal('amount', 15, 2).notNullable()
      table.decimal('total_amount', 15, 2).notNullable()

      table.string('payment_method').nullable().defaultTo('mobile_money')
      table.string('operation_type').nullable()

      table.json('payment_details').nullable()

      table.string('currency_code_from').nullable().defaultTo('XOF')
      table.string('currency_code_to').nullable()
      table.decimal('exchange_rate', 15, 6).nullable()

      table.json('operator_response').nullable()
      table.json('transaction_metadata').nullable()
      table.date('date_payement').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
