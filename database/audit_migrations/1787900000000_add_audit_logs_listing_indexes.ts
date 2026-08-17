import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Index de la file d'audit du back-office.
 *
 * La table ne portait que sa clé primaire : chaque page de la liste triait les 34 000 lignes
 * entières, y compris pour l'ordre par défaut.
 *
 * `created_at` sert l'ordre par défaut et le filtre par période. Les couples le placent en seconde
 * position, car l'ordre final est toujours `created_at desc` : un index sur la seule colonne
 * filtrée obligerait la base à trier le résultat.
 *
 * `request_id` et `ip_address` servent l'enquête — retrouver tous les événements d'une requête ou
 * d'une adresse. Ils sont seuls : ces deux filtres sélectionnent déjà si peu de lignes que l'ordre
 * ne coûte rien.
 */
export default class extends BaseSchema {
  protected tableName = 'audit_logs'
  public static connection = 'audit'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['created_at'], 'audit_logs_created_at_index')
      table.index(['event_category', 'created_at'], 'audit_logs_category_created_at_index')
      table.index(['event_action', 'created_at'], 'audit_logs_action_created_at_index')
      table.index(['actor_id', 'created_at'], 'audit_logs_actor_created_at_index')
      table.index(['result', 'created_at'], 'audit_logs_result_created_at_index')
      table.index(['target_type', 'target_id'], 'audit_logs_target_index')
      table.index(['request_id'], 'audit_logs_request_id_index')
      table.index(['ip_address'], 'audit_logs_ip_address_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['created_at'], 'audit_logs_created_at_index')
      table.dropIndex(['event_category', 'created_at'], 'audit_logs_category_created_at_index')
      table.dropIndex(['event_action', 'created_at'], 'audit_logs_action_created_at_index')
      table.dropIndex(['actor_id', 'created_at'], 'audit_logs_actor_created_at_index')
      table.dropIndex(['result', 'created_at'], 'audit_logs_result_created_at_index')
      table.dropIndex(['target_type', 'target_id'], 'audit_logs_target_index')
      table.dropIndex(['request_id'], 'audit_logs_request_id_index')
      table.dropIndex(['ip_address'], 'audit_logs_ip_address_index')
    })
  }
}