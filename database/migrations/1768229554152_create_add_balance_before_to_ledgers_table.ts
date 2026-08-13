import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ledgers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.decimal('balance_before', 19, 2).notNullable().after('total_amount').defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('balance_before')
    })
  }
}
