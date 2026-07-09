import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Rend `transactions` **account-centrique** (D8, sous-lot 4) — prérequis de l'encaissement
 * marchand : une transaction peut appartenir à un compte **sans user** (compte d'organisation).
 *
 * Additif, sans changement de comportement pour le consumer (pour un user, `account_id ==
 * users_uid`) :
 *  1. ADD `account_id` (uuid, nullable, indexé) — le compte titulaire de la transaction.
 *  2. Backfill `account_id = users_uid` pour les transactions existantes.
 *  3. Relâche `users_uid` en NULLABLE (garde la FK ; une FK autorise NULL) — une transaction
 *     d'org n'a pas de user. ALTER brut pour préserver char(36) + collation.
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    // 1. Colonne account_id (nullable, indexée). Pas de FK (money reste indépendant d'identity ;
    //    le compte vit dans core/money/account).
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('account_id').nullable().after('users_uid').index()
    })

    // 2. Backfill : pour l'existant (consumer), le compte = users_uid.
    this.defer(async (db) => {
      await db.rawQuery('UPDATE `transactions` SET `account_id` = `users_uid` WHERE `account_id` IS NULL')
    })

    // 3. Relâche users_uid en NULLABLE (conserve la FK ; NULL autorisé). ALTER brut pour
    //    préserver char(36) + collation (le builder pourrait basculer CHAR→VARCHAR).
    this.schema.raw(
      'ALTER TABLE `transactions` MODIFY `users_uid` char(36) ' +
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL'
    )
  }

  async down() {
    // NB : échoue s'il existe des transactions d'org (users_uid NULL) — les purger d'abord.
    this.schema.raw(
      'ALTER TABLE `transactions` MODIFY `users_uid` char(36) ' +
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
    )
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('account_id')
    })
  }
}
