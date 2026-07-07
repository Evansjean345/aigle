import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('account_id').notNullable().unique().index()
      table.string('owner_type').notNullable()
      table.uuid('owner_ref').notNullable().index()
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.unique(['owner_type', 'owner_ref'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
