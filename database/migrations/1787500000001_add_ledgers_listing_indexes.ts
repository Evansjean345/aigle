import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Index de la liste des écritures comptables du back-office.
 *
 * La table ne portait que sa clé primaire et la clé étrangère du portefeuille : ni `created_at`,
 * qui est l'ordre de chaque page, ni les colonnes filtrées.
 *
 * `created_at` est en seconde position dans les couples parce que l'ordre final porte dessus — un
 * index sur la seule colonne filtrée obligerait la base à trier le résultat.
 *
 * `(wallet_id, created_at)` sert l'onglet grand livre d'un compte, qui n'est jamais lu sans son
 * ordre chronologique.
 */
export default class extends BaseSchema {
  protected tableName = 'ledgers'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['created_at'], 'ledgers_created_at_index')
      table.index(['wallet_id', 'created_at'], 'ledgers_wallet_created_at_index')
      table.index(['direction', 'created_at'], 'ledgers_direction_created_at_index')
      table.index(['operation_type', 'created_at'], 'ledgers_type_created_at_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['created_at'], 'ledgers_created_at_index')
      table.dropIndex(['wallet_id', 'created_at'], 'ledgers_wallet_created_at_index')
      table.dropIndex(['direction', 'created_at'], 'ledgers_direction_created_at_index')
      table.dropIndex(['operation_type', 'created_at'], 'ledgers_type_created_at_index')
    })
  }
}