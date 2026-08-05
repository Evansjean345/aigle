import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Clé matérielle : ce qui permet de reconnaître un même téléphone d'une application à l'autre.
 *
 * L'empreinte ne le peut pas — elle intègre l'identifiant de l'application, donc un même appareil
 * en produit une par app. La clé matérielle dérive du seul identifiant fourni par la plateforme,
 * sans rien d'applicatif : `identifierForVendor` sur iOS, `ANDROID_ID` sur Android.
 *
 * Nullable, et elle le restera pour beaucoup : la corrélation n'a lieu que si les deux applications
 * relèvent du même compte éditeur (iOS) ou de la même clé de signature (Android). Sinon les valeurs
 * diffèrent et aucun regroupement ne se produit — sans dommage.
 *
 * Indexée sans unicité : plusieurs installations partagent légitimement un téléphone.
 */
export default class extends BaseSchema {
  protected tableName = 'devices'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('hardware_key').nullable().after('identity')
      table.index(['hardware_key'], 'devices_hardware_key_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['hardware_key'], 'devices_hardware_key_index')
      table.dropColumn('hardware_key')
    })
  }
}