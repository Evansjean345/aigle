import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ajoute la clé pivot `account_id` au wallet (D7, additif minimal).
 *
 * Nullable + unique : les wallets existants restent NULL (backfill = users_uid
 * au commit suivant), un même NULL n'entre pas en conflit d'unicité. Pas de FK
 * ni de NOT NULL ici — durcissement (FK vers accounts, NOT NULL) reporté à une
 * passe ultérieure. Le relâchement des colonnes user en nullable (pour les
 * wallets d'organisation sans propriétaire user) arrive avec la feature business.
 */
export default class extends BaseSchema {
  protected tableName = 'wallets'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('account_id').nullable().unique().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('account_id')
    })
  }
}
