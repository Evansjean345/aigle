import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * L'historique des tentatives suit le dossier sur le compte.
 *
 *  1. ADD `account_id`, rempli depuis `user_id` : pour un compte utilisateur,
 *     `account_id == users_uid == user_id` de la tentative.
 *  2. `document_type` devient nullable, et son enum reçoit `PERMIS_CONDUIT` comme celui du dossier.
 *
 * `user_id` est conservé. Additif, aucune donnée métier réécrite.
 */
export default class extends BaseSchema {
  protected tableName = 'kyc_attemps'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('account_id').nullable().after('user_id').index()
      table
        .enum('document_type', ['CNI', 'PASSPORT', 'PERMIS', 'PERMIS_CONDUIT', 'SELFI'])
        .nullable()
        .alter()
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'UPDATE `kyc_attemps` SET `account_id` = `user_id` WHERE `account_id` IS NULL'
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('document_type', ['CNI', 'PASSPORT', 'PERMIS', 'SELFI']).nullable().alter()
      table.dropColumn('account_id')
    })
  }
}
