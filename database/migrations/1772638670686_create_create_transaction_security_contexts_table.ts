import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'transaction_security_contexts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('transaction_id')
        .unsigned()
        .references('id')
        .inTable('transactions')
        .onDelete('CASCADE')
        .notNullable()

      table.string('device_id').nullable().index()

      // Snapshot Technique
      table.string('fingerprint_hash').nullable()
      table.string('ip_address', 45).notNullable()
      table.text('user_agent', 'mediumtext').nullable()
      table.string('os_version', 50).nullable()
      table.string('app_version', 50).nullable()

      // Données Géographiques
      table.string('country_code', 2).nullable()
      table.string('city', 100).nullable()
      table.boolean('is_vpn').defaultTo(false)
      table.decimal('risk_score', 5, 2).nullable()

      table.timestamp('captured_at', { useTz: true }).defaultTo(this.now()).notNullable()

      table.index(['transaction_id'], 'idx_security_transaction')
      table.index(['ip_address'], 'idx_security_ip')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
