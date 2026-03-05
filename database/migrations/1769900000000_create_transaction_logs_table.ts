import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transaction_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.bigIncrements('id')
      table.uuid('transaction_id').notNullable().index()
      table.string('event_type', 50).notNullable()
      table.string('status', 30).notNullable()
      table.jsonb('payload').nullable()
      table.text('error_message').nullable()
      table.string('ip_address', 45).nullable()
      table.string('actor_id').nullable()
      table.string('actor_type', 20).nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
