import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ouvre un compte pour chaque portefeuille existant, et l'y rattache.
 *
 * Un portefeuille sans porteur est ignoré ; un compte déjà ouvert n'est pas dupliqué. La
 * correspondance est directe : `account_id = owner_ref = user_id`.
 *
 * En SQL et non par les modèles : une migration passée doit rester rejouable, or un modèle déplacé
 * ou renommé la casserait rétroactivement. C'est ce qui est arrivé ici, `account` ayant quitté
 * `money` pour `identity`.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        'INSERT INTO `accounts` (`account_id`, `owner_type`, `owner_ref`, `created_at`, `updated_at`) ' +
          "SELECT w.`user_id`, 'user', w.`user_id`, NOW(), NOW() FROM `wallets` w " +
          'WHERE w.`user_id` IS NOT NULL AND w.`account_id` IS NULL ' +
          'AND NOT EXISTS (' +
          "SELECT 1 FROM `accounts` a WHERE a.`owner_type` = 'user' AND a.`owner_ref` = w.`user_id`" +
          ') GROUP BY w.`user_id`'
      )

      await db.rawQuery(
        'UPDATE `wallets` SET `account_id` = `user_id` ' +
          'WHERE `user_id` IS NOT NULL AND `account_id` IS NULL'
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('UPDATE `wallets` SET `account_id` = NULL')
      await db.rawQuery("DELETE FROM `accounts` WHERE `owner_type` = 'user'")
    })
  }
}
