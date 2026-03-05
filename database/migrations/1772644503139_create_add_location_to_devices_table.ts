import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('country_code', 2).nullable().after('ip_last_seen')
      table.string('city').nullable().after('country_code')
      table.boolean('is_vpn').defaultTo(false).after('city')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('country_code')
      table.dropColumn('city')
      table.dropColumn('is_vpn')
    })
  }
}
