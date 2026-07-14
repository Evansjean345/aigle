import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Refactor **account-centric** (É0) — le compte porte désormais son **segment** et son **niveau**
 * (cf. docs/plans/2026-07-10-refactor-account-centric-validation.md, variante β : `Account` migre
 * dans identity ; la table `accounts` ne bouge pas, on l'enrichit).
 *
 * Additif, **zéro drop** (les drops = R4 endgame) :
 *  1. ADD `segment` (`particulier` | `marchand` | `enterprise`) + `level` (int) — nullable le temps
 *     du backfill.
 *  2. Backfill :
 *     - compte **user**  → `segment='particulier'`, `level = users.kyc_level` (1=NOT_VERIFY, 2=KYC_VERIFIED) ;
 *     - compte **org**   → `segment = organisations.account_type` (marchand/enterprise),
 *                          `level = map(organisations.level)` (level_0→0, level_1→1, level_2→2).
 *  3. Filet : les comptes orphelins tombent sur `particulier` / niveau 1.
 *
 * NB collation : si le JOIN `owner_ref = users_uid` échoue (collation différente), ajouter
 * `COLLATE utf8mb4_unicode_ci` de part et d'autre de la comparaison.
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  protected tableName = 'accounts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('segment').nullable().after('owner_ref')
      table.integer('level').nullable().after('segment')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'UPDATE `accounts` a ' +
          'JOIN `users` u ON u.`users_uid` = a.`owner_ref` ' +
          "SET a.`segment` = 'particulier', a.`level` = u.`kyc_level` " +
          "WHERE a.`owner_type` = 'user'"
      )

      // Comptes org : segment = accountType, niveau = mapping du niveau KYB.
      await db.rawQuery(
        'UPDATE `accounts` a ' +
          'JOIN `organisations` o ON o.`organisation_id` = a.`owner_ref` ' +
          'SET a.`segment` = o.`account_type`, a.`level` = CASE o.`level` ' +
          "WHEN 'level_0' THEN 0 WHEN 'level_1' THEN 1 WHEN 'level_2' THEN 2 ELSE 0 END " +
          "WHERE a.`owner_type` = 'organisation'"
      )

      // Filet pour d'éventuels comptes non résolus.
      await db.rawQuery("UPDATE `accounts` SET `segment` = 'particulier' WHERE `segment` IS NULL")
      await db.rawQuery('UPDATE `accounts` SET `level` = 1 WHERE `level` IS NULL')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('segment')
      table.dropColumn('level')
    })
  }
}
