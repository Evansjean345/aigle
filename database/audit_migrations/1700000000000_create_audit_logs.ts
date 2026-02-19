import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'
  public static connection = 'audit'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary()
      table.integer('admin_id').unsigned().nullable()
      table.string('event', 150).notNullable()
      table.string('target_type', 100).nullable()
      table.string('target_id', 100).nullable()
      table.jsonb('payload').nullable()
      table.jsonb('metadata').nullable()
      table.timestamp('created_at', { useTz: true }).defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
