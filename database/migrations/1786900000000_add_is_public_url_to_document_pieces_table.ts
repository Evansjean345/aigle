import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_pieces'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.boolean('is_public_url').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('is_public_url')
    })
  }
}
