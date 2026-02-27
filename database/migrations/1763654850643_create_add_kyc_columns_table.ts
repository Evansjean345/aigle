import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('kyc_level').defaultTo(1)
      table
        .enum('kyc_status', ['NOT_STARTED', 'PENDING_IN_REVIEW', 'LEVEL_1_VERIFIED', 'REJECTED'])
        .defaultTo('NOT_STARTED')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('kyc_level')
      table.dropColumn('kyc_status')
    })
  }
}
