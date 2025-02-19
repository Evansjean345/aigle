import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.alterTable('transactions', (table) => {
      table.string('step').nullable()
      table
        .integer('services_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('services')
        .onDelete('SET NULL')
        .onUpdate('SET NULL')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
