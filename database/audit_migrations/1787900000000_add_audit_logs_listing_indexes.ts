import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Index de la file d'audit du back-office.
 *
 * La table ne portait que sa clé primaire : chaque page de la liste triait les 34 000 lignes
 * entières, y compris pour l'ordre par défaut.
 *
 * `created_at` sert l'ordre par défaut et le filtre par période ; `event_category` et le couple
 * `(event_category, created_at)` servent le tri et le filtrage par catégorie.
 */
export default class extends BaseSchema {
  protected tableName = 'audit_logs'
  public static connection = 'audit'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.index(['created_at'], 'audit_logs_created_at_index')
      table.index(['event_category', 'created_at'], 'audit_logs_category_created_at_index')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropIndex(['created_at'], 'audit_logs_created_at_index')
      table.dropIndex(['event_category', 'created_at'], 'audit_logs_category_created_at_index')
    })
  }
}
