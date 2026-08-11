import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Une tentative de vérification peut n'avoir aucun porteur.
 *
 * `user_id` était `NOT NULL` depuis la création de la table, à l'époque où seule une personne
 * physique se vérifiait. Un dossier d'organisation n'a pas d'utilisateur : c'est `account_id` qui
 * l'identifie, et il est renseigné dans tous les cas.
 *
 * Additif : aucune ligne existante n'est invalidée.
 */
export default class extends BaseSchema {
  protected tableName = 'kyc_attemps'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('user_id').nullable().alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('user_id').notNullable().alter()
    })
  }
}
