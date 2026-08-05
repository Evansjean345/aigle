import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Enregistre la solidité de l'identité déclarée par un appareil.
 *
 * `strong` : l'empreinte dérive d'un identifiant fourni par la plateforme, propre à l'appareil.
 * `weak` : cet identifiant était indisponible, l'empreinte ne vaut que pour cette installation et ne
 * survivra pas à une réinstallation.
 *
 * Nullable, et les lignes existantes le restent : leur empreinte a été calculée par une formule qui
 * pouvait retomber sur les attributs de modèle, sans qu'on sache après coup si elle l'a fait. Un
 * `null` dit « on ne sait pas », ce qui est la seule chose vraie à leur sujet.
 */
export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('identity', ['strong', 'weak']).nullable().after('device_uid')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('identity')
    })
  }
}