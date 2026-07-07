import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'kyc_documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.date('valid_until').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('valid_until')
    })
  }
}
