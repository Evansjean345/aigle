import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'app_versions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.enum('device_type', ['ios', 'android']).notNullable()
      table.string('version_number').notNullable() // La última versión disponible
      table.string('min_version').notNullable() // La versión mínima requerida (obsolescencia)
      table.boolean('critical_update').defaultTo(false)
      table.date('release_date').notNullable()
      table.string('download_url').nullable()
      table.text('changelog').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
