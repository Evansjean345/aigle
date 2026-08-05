import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lève l'unicité de `devices.fingerprint_hash`.
 *
 * L'unicité rendait l'écrasement obligatoire : deux appareils produisant la même empreinte ne
 * pouvaient pas coexister, si bien que le second reprenait la ligne du premier — et son `device_uid`
 * avec. L'utilisateur légitime se retrouvait rejeté par sa propre garde de confiance.
 *
 * L'identité d'une ligne devient la paire `(fingerprint_hash, device_uid)`, ce que les quatre points
 * de lecture vérifiaient déjà de fait. `device_uid` reste unique : étant tiré au hasard, il ne
 * collisionne pas, et c'est lui qui garantit qu'une ligne désigne une installation et une seule.
 *
 * L'empreinte garde un index non unique : elle sert toujours à retrouver les lignes d'un même
 * appareil, elle cesse seulement d'en imposer une seule.
 */
export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.defer(async (db) => {
      const [indexes] = await db.rawQuery(
        `SHOW INDEX FROM devices WHERE Column_name = 'fingerprint_hash' AND Non_unique = 0`
      )

      for (const index of indexes as { Key_name: string }[]) {
        await db.rawQuery(`ALTER TABLE devices DROP INDEX \`${index.Key_name}\``)
      }

      await db.rawQuery(
        `CREATE INDEX devices_fingerprint_hash_index ON devices (fingerprint_hash)`
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`DROP INDEX devices_fingerprint_hash_index ON devices`)
      await db.rawQuery(
        `ALTER TABLE devices ADD UNIQUE devices_fingerprint_hash_pk (fingerprint_hash)`
      )
    })
  }
}