import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Porte la version d'application sur la liaison plutôt que sur le matériel.
 *
 * `devices.app_version` est une colonne du matériel, écrasée par la dernière app qui s'enregistre :
 * un téléphone portant AigleSend et AigleBusiness n'en garde qu'une, sans dire laquelle. La version
 * appartient à l'installation, donc à la liaison.
 *
 * Reprise des lignes existantes : la valeur du matériel n'est reportée que lorsqu'une seule liaison
 * la revendique — dans ce cas elle est certaine. Les liaisons multiples restent nulles et se
 * remplissent à la prochaine connexion, plutôt que d'afficher une version peut-être fausse.
 */
export default class extends BaseSchema {
  protected tableName = 'user_devices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('app_version').nullable().after('app')
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE user_devices ud
        JOIN devices d ON d.id = ud.device_id
        JOIN (
          SELECT device_id, user_id
          FROM user_devices
          GROUP BY device_id, user_id
          HAVING COUNT(*) = 1
        ) unique_link
          ON unique_link.device_id = ud.device_id AND unique_link.user_id = ud.user_id
        SET ud.app_version = d.app_version
        WHERE d.app_version IS NOT NULL
      `)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('app_version')
    })
  }
}
