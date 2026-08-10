import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * `kyc_documents` devient le dossier de vérification d'un **compte**, quel que soit son propriétaire.
 *
 *  1. `account_id` passe NOT NULL — la colonne existe et a été remplie par
 *     `add_account_id_to_kyc_documents`.
 *  2. `owner_type` distingue un dossier d'utilisateur d'un dossier d'organisation. Les lignes
 *     existantes sont toutes des dossiers d'utilisateur.
 *  3. `document_type` devient nullable : il qualifie la pièce d'identité d'un dossier utilisateur et
 *     ne vaut rien pour une organisation. La redéclaration de l'enum ajoute `PERMIS_CONDUIT`, la
 *     valeur que le code produit et que l'enum d'origine ne contenait pas ; `PERMIS` est conservé
 *     pour ne pas invalider de ligne existante.
 *
 * `user_id` est conservé.
 *
 * ⚠️ Vérifier avant de lancer qu'aucune ligne n'a `account_id IS NULL`, sinon l'ajout de la
 * contrainte échoue.
 */
export default class extends BaseSchema {
  protected tableName = 'kyc_documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('account_id').notNullable().alter()
      table.string('owner_type').notNullable().defaultTo('user').after('account_id')
      table
        .enum('document_type', ['CNI', 'PASSPORT', 'PERMIS', 'PERMIS_CONDUIT', 'SELFI'])
        .nullable()
        .alter()
      table.index(['owner_type'], 'kyc_documents_owner_type_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['owner_type'], 'kyc_documents_owner_type_index')
      table.dropColumn('owner_type')
      table.enum('document_type', ['CNI', 'PASSPORT', 'PERMIS', 'SELFI']).nullable().alter()
      table.uuid('account_id').nullable().alter()
    })
  }
}
