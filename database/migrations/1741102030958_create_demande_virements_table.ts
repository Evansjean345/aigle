import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'demande_virements'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')

      table.uuid('demande_virements_uid').index()
      table
        .integer('users_id')
        .notNullable()
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('cascade')
        .onUpdate('cascade')

      table.string('fill_name').nullable()
      table.string('bank_name').nullable()

      table.string('email').nullable()
      table.string('virement_doc').nullable()
      table.string('virement_doc').nullable()
      table.string('virement_doc').nullable()
      table.string('virement_doc_verso').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
