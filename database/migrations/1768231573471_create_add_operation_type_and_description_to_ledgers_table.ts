import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'ledgers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('operation_type').nullable().after('wallet_id')
      table.string('description').nullable().after('operation_type')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('operation_type')
      table.dropColumn('description')
    })
  }
}
