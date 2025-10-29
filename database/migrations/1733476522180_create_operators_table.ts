import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'operators'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('operators_uid')

      table
        .integer('type_payments_id')
        .nullable()
        .unsigned()
        .references('id')
        .inTable('type_payments')
        .onDelete('set null')
        .onUpdate('set null')

      table.decimal('fees,', 10, 2).defaultTo(0)
      table.string('name').nullable()
      table.string('image_path').nullable()
      table.string('status').defaultTo('active')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
