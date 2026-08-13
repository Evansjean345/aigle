import { BaseSchema } from '@adonisjs/lucid/schema'

/** Tables dont au moins une colonne s'écarte de la collation cible. */
const TABLES = [
  'accounts',
  'admin_auth_access_tokens',
  'admins',
  'collection_accounts',
  'company_contacts',
  'devices',
  'document_pieces',
  'funding_requests',
  'kyc_attemps',
  'kyc_documents',
  'kyc_level',
  'ledgers',
  'organisation_members',
  'organisation_role_permissions',
  'organisation_roles',
  'organisations',
  'payable_aliases',
  'permissions',
  'refunds',
  'roles',
  'transaction_security_contexts',
  'transfer_batches',
  'transfer_items',
  'user_devices',
  'wallet_adjustments',
]

/**
 * Unifie la base sur `utf8mb4` / `utf8mb4_unicode_ci`.
 *
 * Aucune migration ne déclarait de jeu de caractères : chaque table a hérité du défaut du serveur
 * au moment où elle a été créée, d'où quatre collations coexistantes. Deux colonnes de collations
 * différentes ne se comparent pas — la requête échoue à l'exécution.
 *
 * Les tables en `latin1` portent en plus un risque de perte : tout caractère hors ISO-8859-1 y est
 * remplacé à l'écriture. La conversion les récupère telles qu'elles sont ; ce qui a déjà été perdu
 * ne revient pas.
 *
 * ⚠️ Les index sur colonnes de texte sont reconstruits. Prévoir une fenêtre proportionnelle au
 * volume, et une sauvegarde préalable.
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      for (const table of TABLES) {
        await db.rawQuery(
          `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        )
      }
    })
  }

  /**
   * Sans retour arrière.
   *
   * Restaurer les collations d'origine demanderait de les rétablir colonne par colonne, et
   * réintroduirait le défaut. Une base convertie se répare par restauration de sauvegarde.
   */
  async down() {}
}
