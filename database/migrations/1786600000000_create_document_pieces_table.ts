import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Pièces d'un dossier de vérification.
 *
 * Une pièce porte son rôle (`piece_type`) et la clé de l'objet déposé sur le stockage privé. Elle
 * ne stocke jamais d'URL : la consultation passe par une URL signée générée à la lecture, qui
 * expire.
 *
 * `reference` porte le numéro inscrit sur la pièce quand elle en a un — RCCM, DFE. Nul pour une
 * pièce d'identité.
 *
 * L'unicité `(kyc_document_id, piece_type)` fait qu'une resoumission remplace la pièce au lieu de
 * l'empiler.
 */
export default class extends BaseSchema {
  protected tableName = 'document_pieces'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('kyc_document_id')
        .unsigned()
        .references('id')
        .inTable('kyc_documents')
        .onDelete('CASCADE')
        .notNullable()
      table.string('piece_type').notNullable()
      table.string('file_key', 512).notNullable()
      table.string('reference').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')

      table.unique(['kyc_document_id', 'piece_type'], 'document_pieces_document_type_unique')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
