import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Refactor account-centric (É2) — le compte porte son **statut opérationnel** (`status`),
 * synchronisé depuis le propriétaire (push-sync : identity pousse `user.status`, le produit pousse
 * `organisation.status`). Lu par la validation money via `getStanding` (le compte est la source
 * unique en lecture).
 *
 * Additif, **zéro drop** :
 *  1. ADD `status` (`active` | `blocked`, défaut `active`).
 *  2. Backfill : compte user → `active` si `users.status = 'active'`, sinon `blocked` ;
 *     compte org → `active` si `organisations.status = 'active'`, sinon `blocked`.
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  protected tableName = 'accounts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('status').notNullable().defaultTo('active').after('level')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'UPDATE `accounts` a ' +
          'JOIN `users` u ON u.`users_uid` = a.`owner_ref` ' +
          "SET a.`status` = CASE u.`status` WHEN 'active' THEN 'active' ELSE 'blocked' END " +
          "WHERE a.`owner_type` = 'user'"
      )
      await db.rawQuery(
        'UPDATE `accounts` a ' +
          'JOIN `organisations` o ON o.`organisation_id` = a.`owner_ref` ' +
          "SET a.`status` = CASE o.`status` WHEN 'active' THEN 'active' ELSE 'blocked' END " +
          "WHERE a.`owner_type` = 'organisation'"
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
    })
  }
}
