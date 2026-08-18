import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Index de la liste des transactions du back-office.
 *
 * La table ne portait aucun index sur `created_at`, qui est pourtant l'ordre de chaque page et le
 * champ du filtre par période : chaque liste triait la table entière.
 *
 * `created_at` est en seconde position dans les couples parce que l'ordre final porte dessus — un
 * index sur la seule colonne filtrée obligerait la base à trier le résultat.
 */
export default class extends BaseSchema {
  protected tableName = 'transactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['created_at'], 'transactions_created_at_index')
      table.index(['status', 'created_at'], 'transactions_status_created_at_index')
      table.index(['operation_type', 'created_at'], 'transactions_type_created_at_index')
      table.index(['account_id', 'created_at'], 'transactions_account_created_at_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['created_at'], 'transactions_created_at_index')
      table.dropIndex(['status', 'created_at'], 'transactions_status_created_at_index')
      table.dropIndex(['operation_type', 'created_at'], 'transactions_type_created_at_index')
      table.dropIndex(['account_id', 'created_at'], 'transactions_account_created_at_index')
    })
  }
}