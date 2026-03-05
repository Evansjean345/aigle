import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('city')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('city', 100).nullable().after('country_code')
    })
  }
}
