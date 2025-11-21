import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'kyc_level'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('level').defaultTo(1)
      table.integer('single_limit').defaultTo(0)
      table.integer('daily_limit').defaultTo(0)
      table.integer('monthly_limit').defaultTo(0)
      table.integer('balance_limit').defaultTo(0)
      table.boolean('is_active').defaultTo(true)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
