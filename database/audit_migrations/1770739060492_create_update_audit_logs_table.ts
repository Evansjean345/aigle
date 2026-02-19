import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'audit_logs'
  public static connection = 'audit'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // New event structure
      table.string('event_category', 100).nullable()
      table.string('event_action', 150).nullable()

      // Actor information
      table.string('actor_id', 100).nullable()
      table.string('actor_type', 100).nullable()
      table.string('actor_role', 100).nullable()
      table.string('initiated_by_type', 100).nullable()
      table.string('initiated_by_id', 100).nullable()

      // Request context
      table.string('request_id', 150).nullable()
      table.string('ip_address', 64).nullable()
      table.string('user_agent', 255).nullable()

      // Targets
      table.string('target_type', 100).nullable().alter()
      table.string('target_id', 150).nullable().alter()

      // Data changes and metadata
      table.jsonb('old_values').nullable()
      table.jsonb('new_values').nullable()
      table.jsonb('metadata').nullable().alter()

      // Outcome
      table.string('result', 50).nullable()
      table.string('error_code', 100).nullable()
      table.string('error_message', 255).nullable()

      // Cleanup legacy columns
      table.dropColumns('event', 'admin_id', 'payload')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      // Recreate legacy columns
      table.string('event', 150).notNullable()
      table.integer('admin_id').unsigned().nullable()
      table.jsonb('payload').nullable()

      // Drop newly added columns
      table.dropColumns(
        'event_category',
        'event_action',
        'actor_id',
        'actor_type',
        'actor_role',
        'request_id',
        'ip_address',
        'user_agent',
        'old_values',
        'new_values',
        'result',
        'error_code',
        'error_message'
      )
    })
  }
}
