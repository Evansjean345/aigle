import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Sépare le commentaire du premier valideur de celui qui clôt le dossier.
 *
 * Les deux gestionnaires peuvent commenter : avec une colonne unique, le second écrasait le constat
 * du premier, et rien n'indiquait à qui appartenait le texte affiché.
 */
export default class extends BaseSchema {
  protected tableName = 'funding_requests'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.text('first_approval_comment', 'mediumtext').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('first_approval_comment')
    })
  }
}
