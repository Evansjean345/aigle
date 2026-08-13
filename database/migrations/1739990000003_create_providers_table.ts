import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'providers'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('code', 50).notNullable().unique()
      table.string('name', 100).notNullable()
      table.enum('type', ['mobile_money', 'bank', 'aggregator']).notNullable()
      table.enum('status', ['active', 'inactive']).nullable().defaultTo('active')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
