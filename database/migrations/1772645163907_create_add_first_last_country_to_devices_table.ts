import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('first_country_code', 2).nullable().after('country_code')
      table.string('last_country_code', 2).nullable().after('first_country_code')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('first_country_code')
      table.dropColumn('last_country_code')
    })
  }
}
