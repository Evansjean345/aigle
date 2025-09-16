import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('doucuments_uid').index()
      table
        .integer('users_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('cascade')
        .onUpdate('cascade')

      table.string('doc_recto').nullable()
      table.string('doc_verso').nullable()

      table.string('type').nullable()
      table.string('dfe').nullable()

      table.string('rccm').nullable()
      table.string('status').defaultTo('pending')

      table
        .uuid('users_uid')
        .references('users_uid')
        .inTable('users')
        .onDelete('cascade')
        .onUpdate('cascade')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
