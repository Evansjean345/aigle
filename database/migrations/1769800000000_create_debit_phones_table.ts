import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'debit_phones'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .uuid('user_id')
        .notNullable()
        .references('users_uid')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('provider_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('providers')
        .onDelete('CASCADE')

      table.string('phone', 20).notNullable()
      table.string('label').nullable()
      table.boolean('is_verified').defaultTo(false)
      table.boolean('is_active').defaultTo(true)
      table.timestamp('verified_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.unique(['user_id', 'provider_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
