import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rattache un gestionnaire au dossier de vérification et à chaque tentative.
 *
 * Sans contrainte de clé étrangère : un gestionnaire supprimé ne doit pas emporter l'historique
 * des décisions, ni les bloquer.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('kyc_documents', (table) => {
      table.integer('agent_id').nullable()
    })
    this.schema.alterTable('kyc_attemps', (table) => {
      table.integer('agent_id').nullable()
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
