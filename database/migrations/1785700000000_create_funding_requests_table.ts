import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Déclarations de versement des marchands.
 *
 * Aucune clé étrangère vers le core : l'organisation et le compte de collecte sont référencés par
 * leur identifiant applicatif.
 */
export default class extends BaseSchema {
  protected tableName = 'funding_requests'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('reference').notNullable().unique()

      table.string('organisation_id').notNullable().index()
      table.string('declared_by_user_id').notNullable()
      table.string('collection_account_reference').notNullable().index()

      // Montant déclaré par le marchand, non vérifié. Précision alignée sur `transfer_batches`.
      table.decimal('declared_amount', 15, 2).notNullable()

      // Clé de l'objet sur le stockage privé, jamais une URL : celle-ci est signée et expire.
      table.string('document_key').notNullable()

      // Colonne texte et non enum, pour pouvoir ajouter des statuts sans ALTER TABLE.
      table.string('status').notNullable().index()

      table.timestamp('cancelled_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // La file de traitement du back-office se lit par organisation et par statut.
      table.index(['organisation_id', 'status'], 'idx_funding_requests_org_status')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
