import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .bigInteger('country_id')
        .unsigned()
        .nullable()
        .references('id')

        .inTable('countries')
        .onDelete('SET NULL')
        .onUpdate('CASCADE')
      table.bigInteger('account_number').unsigned().index().unique()
      table.uuid('users_uid').index()
      table.string('firstname')
      table.string('identity_status').defaultTo('pending')
      table.string('picture_url').nullable()
      table.string('lastname')
      table.string('phone').unique().index()
      table.string('email').nullable().unique().index()
      table.date('birthday').nullable()
      table.string('status').defaultTo('active')
      table.string('adresse').nullable()
      table.string('account_type').defaultTo('freemium')
      table.string('pincode')
      table.string('password')
      table.string('remember_me_token').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
