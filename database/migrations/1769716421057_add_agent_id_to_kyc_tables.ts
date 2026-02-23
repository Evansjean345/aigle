import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('kyc_documents', (table) => {
      table.integer('agent_id').unsigned().references('id').inTable('admins').nullable()
    })
    this.schema.alterTable('kyc_attemps', (table) => {
      table.integer('agent_id').unsigned().references('id').inTable('admins').nullable()
    })
  }

  async down() {
    this.schema.alterTable('kyc_documents', (table) => {
      table.dropColumn('agent_id')
    })
    this.schema.alterTable('kyc_attemps', (table) => {
      table.dropColumn('agent_id')
    })
  }
}
