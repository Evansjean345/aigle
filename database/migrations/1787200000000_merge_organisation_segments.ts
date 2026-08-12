import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Fusionne `marchand` et `enterprise` en `organisation`, sur les comptes et sur la grille.
 *
 * Retire au passage `is_active` et `is_archived` de `kyc_level` : aucune requête ne les lit, un
 * palier marqué archivé servait ses plafonds normalement.
 *
 * ⚠️ Ne pas lancer `kyc:levels:sync` entre le déploiement du code et cette migration : le catalogue
 * déclare déjà `organisation:*` et la synchronisation créerait ces lignes à côté des anciennes, ce
 * qui ferait échouer le remappage sur la contrainte d'unicité `(segment, level)`.
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      await db.rawQuery(
        "UPDATE `accounts` SET `segment` = 'organisation' WHERE `segment` IN ('marchand', 'enterprise')"
      )
      await db.rawQuery(
        "UPDATE `kyc_level` SET `segment` = 'organisation' WHERE `segment` IN ('marchand', 'enterprise')"
      )
    })

    this.schema.alterTable('kyc_level', (table) => {
      table.dropColumn('is_active')
      table.dropColumn('is_archived')
    })
  }

  async down() {
    this.schema.alterTable('kyc_level', (table) => {
      table.boolean('is_active').defaultTo(true)
      table.boolean('is_archived').defaultTo(false)
    })

    this.defer(async (db) => {
      // Le segment se recompose depuis le profil de vérification, seul à distinguer encore un
      // marchand d'une entreprise.
      await db.rawQuery(
        "UPDATE `accounts` SET `segment` = 'enterprise' " +
          "WHERE `segment` = 'organisation' AND `verification_profile` = 'immatriculation'"
      )
      await db.rawQuery(
        "UPDATE `accounts` SET `segment` = 'marchand' " +
          "WHERE `segment` = 'organisation' AND `verification_profile` = 'none'"
      )
      await db.rawQuery(
        "UPDATE `kyc_level` SET `segment` = 'marchand' WHERE `segment` = 'organisation' AND `level` = 1"
      )
      await db.rawQuery(
        "UPDATE `kyc_level` SET `segment` = 'enterprise' WHERE `segment` = 'organisation' AND `level` IN (0, 2)"
      )
    })
  }
}
