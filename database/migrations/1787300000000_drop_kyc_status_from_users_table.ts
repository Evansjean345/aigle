import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Retire `users.kyc_status` : le statut de vérification se dérive désormais du dossier.
 *
 * Signale au passage les comptes portant plusieurs dossiers — `kyc_documents.account_id` n'est
 * qu'indexé, et la dérivation retient le plus récent.
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.defer(async (db) => {
      const rows = await db.rawQuery(
        'SELECT COUNT(*) as total FROM (' +
          'SELECT `account_id` FROM `kyc_documents` GROUP BY `account_id` HAVING COUNT(*) > 1' +
          ') as duplicates'
      )

      const total = Number(rows?.[0]?.[0]?.total ?? 0)

      if (total > 0) {
        console.warn(
          `[kyc] ${total} compte(s) portent plusieurs dossiers : la dérivation retient le plus récent.`
        )
      }
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('kyc_status')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('kyc_status').defaultTo('NOT_STARTED')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'UPDATE `users` u SET u.`kyc_status` = CASE (' +
          'SELECT d.`status` FROM `kyc_documents` d ' +
          'WHERE d.`account_id` COLLATE utf8mb4_unicode_ci = u.`users_uid` COLLATE utf8mb4_unicode_ci ' +
          'ORDER BY d.`created_at` DESC LIMIT 1' +
          ") WHEN 'pending' THEN 'PENDING_IN_REVIEW' " +
          "WHEN 'approved' THEN 'VERIFIED' " +
          "WHEN 'rejected' THEN 'REJECTED' " +
          "ELSE 'NOT_STARTED' END"
      )
    })
  }
}
