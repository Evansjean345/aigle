import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Refactor **account-centric** (É0) — ancrage des docs de vérification sur le **compte** (P6-A,
 * compat). Additif, **zéro drop** : `user_id` est conservé jusqu'au R4.
 *
 *  1. ADD `account_id` (uuid, nullable, indexé).
 *  2. Backfill `account_id = user_id` : pour un user, `account_id == users_uid == user_id` du doc KYC.
 *
 * (Le KYB — docs d'organisation ancrés `account_id` — est hors de ce lot.)
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  protected tableName = 'kyc_documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('account_id').nullable().after('user_id').index()
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'UPDATE `kyc_documents` SET `account_id` = `user_id` WHERE `account_id` IS NULL'
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('account_id')
    })
  }
}
