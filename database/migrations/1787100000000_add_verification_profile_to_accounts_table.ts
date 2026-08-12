import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Ajoute au compte le **profil de vérification** : le jeu de pièces qu'on attend de lui.
 *
 * Le segment portait cette information en plus de désigner la grille de plafonds. Le profil la
 * reprend, ce qui laisse le segment libre d'être fusionné.
 *
 * Remplissage depuis le segment actuel — `enterprise` dépose son immatriculation, `marchand` ne
 * dépose rien, tout le reste dépose une identité. Un compte non résolu tombe sur `identite`, le
 * profil le plus exigeant.
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  protected tableName = 'accounts'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('verification_profile').nullable().after('segment')
    })

    this.defer(async (db) => {
      await db.rawQuery(
        "UPDATE `accounts` SET `verification_profile` = 'immatriculation' WHERE `segment` = 'enterprise'"
      )
      await db.rawQuery(
        "UPDATE `accounts` SET `verification_profile` = 'none' WHERE `segment` = 'marchand'"
      )
      await db.rawQuery(
        "UPDATE `accounts` SET `verification_profile` = 'identite' WHERE `verification_profile` IS NULL"
      )
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('verification_profile')
    })
  }
}
