import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Le palier d'un compte ne vit plus que sur `accounts`.
 *
 * `users.kyc_level` dupliquait `accounts.level`, sans porter le segment. La relation qui le lisait
 * joignait `kyc_level` sur le seul niveau, alors que le niveau 2 existe pour `particulier` comme
 * pour `enterprise` : elle rendait une ligne arbitraire, donc des plafonds indéterminés.
 *
 * Plus aucun code ne lit ni n'écrit cette colonne : les plafonds se résolvent par
 * `(segment, level)` du compte, et le niveau voyage désormais dans `UserKycStatusUpdated` au lieu
 * de transiter par `users`.
 *
 * Le `down()` recrée la colonne et la réalimente depuis le compte — le sens inverse du remplissage
 * qui l'avait vidée vers `accounts`.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('kyc_level')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('kyc_level').defaultTo(1)
    })

    this.defer(async (db) => {
      await db.rawQuery(
        'UPDATE `users` u ' +
          'JOIN `accounts` a ON a.`owner_ref` = u.`users_uid` ' +
          'SET u.`kyc_level` = a.`level` ' +
          "WHERE a.`owner_type` = 'user' AND a.`level` IS NOT NULL"
      )
    })
  }
}
