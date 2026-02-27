import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'roles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('slug', 50).unique().notNullable()
      table.string('name', 100).notNullable()
      table.text('description').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable('permissions', (table) => {
      table.increments('id').primary()
      table.string('slug', 50).unique().notNullable()
      table.string('name', 100).notNullable()
      table.text('description').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })

    this.schema.createTable('role_permission', (table) => {
      table.increments('id').primary()
      table.integer('role_id').unsigned().references('id').inTable('roles').onDelete('CASCADE')
      table
        .integer('permission_id')
        .unsigned()
        .references('id')
        .inTable('permissions')
        .onDelete('CASCADE')
      table.unique(['role_id', 'permission_id'])
    })
  }

  async down() {
    this.schema.dropTable('role_permission')
    this.schema.dropTable('permissions')
    this.schema.dropTable('roles')
  }
}
