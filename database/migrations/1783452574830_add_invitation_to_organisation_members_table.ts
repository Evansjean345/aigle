import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Invitation de membre (Lot B) : token du lien web + expiration (48h). Le statut
 * `removed` s'ajoute côté applicatif (colonne `status` déjà VARCHAR, pas de DDL).
 */
export default class extends BaseSchema {
  protected tableName = 'organisation_members'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('invitation_token').nullable().index()
      table.timestamp('invitation_expires_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('invitation_token')
      table.dropColumn('invitation_expires_at')
    })
  }
}
