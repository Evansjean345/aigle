import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'services'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('services_uid')
      table.string('name').nullable()
      table.string('image_path').nullable()
      table.string('status').defaultTo('active')
      table.integer('poucentage_service_fee').defaultTo(0)
      table.decimal('fees', 15, 2).defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
