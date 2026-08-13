import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ajoute la réponse brute du prestataire au paiement.
 *
 * Déclarait `callback_status`, colonne qu'aucun code ne lit et qui n'existe pas en base : elle y a
 * été remplacée à la main par `operator_response`, que le règlement des dépôts consomme.
 */
export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.json('operator_response').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('operator_response')
    })
  }
}
