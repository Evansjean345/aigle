import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payments'
  async up() {
    this.schema.alterTable('payments', (table) => {
      table.boolean('callback_status').defaultTo(false)
    })
  }

  async down() {}
}
