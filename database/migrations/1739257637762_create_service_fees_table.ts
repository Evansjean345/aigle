import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'service_fees'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table
        .integer('services_id')
        .nullable()
        .unsigned()
        .references('id')
        .inTable('services')
        .onDelete('set null')
        .onUpdate('set null')
      table.string('services_type').notNullable()
      table.decimal('min_amount', 10, 2).defaultTo(0)
      table.decimal('max_amount', 10, 2).defaultTo(0)
      table.decimal('fixed_fee', 10, 2).defaultTo(0)
      table.decimal('percentage_fee', 5, 2).defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
