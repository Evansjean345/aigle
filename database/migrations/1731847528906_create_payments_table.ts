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

      table.string('step').nullable()
      table.string('status').notNullable().defaultTo('pending')

      table.string('payment_method').nullable().defaultTo('mobile_money')
      table.string('operation_type').nullable()

      table.json('payment_details').nullable()

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
