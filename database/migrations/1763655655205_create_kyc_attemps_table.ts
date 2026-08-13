import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'kyc_attemps'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.uuid('user_id').notNullable()
      table
        .integer('kyc_document_id')
        .unsigned()
        .references('id')
        .inTable('kyc_documents')
        .onDelete('CASCADE')
        .nullable()
      table.enum('document_type', ['CNI', 'PASSPORT', 'PERMIS', 'SELFI']).nullable()
      table.text('document_recto_url').nullable()
      table.text('document_verso_url').nullable()
      table.text('selfie_url').nullable()
      table.integer('attempt_number').defaultTo(0)
      table.enum('status', ['pending', 'approved', 'rejected'])
      table.text('comment').nullable()
      table.string('next_action').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
