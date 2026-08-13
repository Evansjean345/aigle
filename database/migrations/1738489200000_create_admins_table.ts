import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'admins'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.string('firstname').notNullable()
      table.string('lastname').notNullable()
      table.string('email').unique().notNullable()
      table.string('password').notNullable()
      table.boolean('is_active').defaultTo(true)

      table.string('last_login_ip').nullable()
      table.timestamp('last_login_at').nullable()

      /** Invitation en attente : le jeton et sa péremption. */
      table.text('invitation_token', 'mediumtext').nullable()
      table.dateTime('invitation_expires_at').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
