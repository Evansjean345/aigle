import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.text('token')
      table.string('user_id').nullable().defaultTo(null)
      table.string('app_version').nullable().defaultTo(null)
      table.string('ios_app_version').nullable().defaultTo(null)
      table.string('android_app_version').nullable().defaultTo(null)
      table.string('platform').nullable().defaultTo(null)
      table.string('platform_version').nullable().defaultTo(null)
      table.string('user_agent').nullable().defaultTo(null)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
