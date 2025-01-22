import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'currencies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments()
      table.string('code').unique().notNullable()
      table.string('name').notNullable()
      table.string('symbol').nullable()
      table.decimal('exchange_rate', 18, 10).defaultTo(1)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
