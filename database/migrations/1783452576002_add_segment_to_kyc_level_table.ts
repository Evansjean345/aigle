import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Refactor **account-centric** (É0) — `kyc_level` devient la grille **`(segment, level) → limites`**
 * partagée par tous les segments (particulier / marchand / enterprise), cf. décision N2 du plan.
 *
 * Additif :
 *  1. ADD `segment` (`particulier` par défaut) — les lignes existantes sont des niveaux **particulier**.
 *  2. Backfill des lignes existantes → `segment='particulier'`.
 *  3. Unique **`(segment, level)`** (un seul jeu de limites par couple).
 *
 * Les lignes **marchand / enterprise** sont ajoutées par le **seeder** `kyc_level_seeder`
 * (P22 : valeurs à fournir). Plafonds `NULL` = **illimité** (les colonnes limites sont déjà nullables).
 *
 * L'USER exécute la migration (`node ace migration:run`) puis le seeder.
 */
export default class extends BaseSchema {
  protected tableName = 'kyc_level'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('segment').defaultTo('particulier').after('id')
    })

    this.defer(async (db) => {
      await db.rawQuery("UPDATE `kyc_level` SET `segment` = 'particulier' WHERE `segment` IS NULL")
    })

    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['segment', 'level'])
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['segment', 'level'])
      table.dropColumn('segment')
    })
  }
}
