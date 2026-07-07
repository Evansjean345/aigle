import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Relâche `wallets.user_id` en NULLABLE (D7) — requis pour les wallets
 * d'organisation, dont le propriétaire n'est pas un user (userId = null).
 *
 * On conserve la FK `wallets_users_uid_foreign` (user_id → users.users_uid) :
 * une contrainte de clé étrangère autorise NULL par défaut, donc un wallet d'org
 * (user_id NULL) reste valide. Seule la nullabilité change ; type char(36) et
 * collation préservés via un ALTER brut (le builder pourrait basculer CHAR→VARCHAR).
 *
 * Additif : les wallets consumer existants (user_id renseigné) sont intacts.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.raw(
      'ALTER TABLE `wallets` MODIFY `user_id` char(36) ' +
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL'
    )
  }

  async down() {
    // NB : échoue s'il existe des wallets d'org (user_id NULL) — les purger d'abord.
    this.schema.raw(
      'ALTER TABLE `wallets` MODIFY `user_id` char(36) ' +
        'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
    )
  }
}
