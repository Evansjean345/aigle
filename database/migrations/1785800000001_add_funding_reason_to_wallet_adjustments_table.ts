import { BaseSchema } from '@adonisjs/lucid/schema'

/** Valeurs déjà présentes dans l'énumération, à reprendre intégralement lors du redéclarage. */
const EXISTING_REASONS = [
  'missing_debit',
  'duplicate_credit',
  'duplicate_debit',
  'reconciliation_gap',
  'system_error',
  'other',
]

/**
 * Ajoute le motif `funding_request` aux ajustements de wallet.
 *
 * `wallet_adjustments.reason` est un ENUM MySQL : ajouter une valeur exige de redéclarer la colonne
 * avec l'ensemble des valeurs existantes, sous peine de rendre illisibles les lignes déjà écrites.
 */
export default class extends BaseSchema {
  protected tableName = 'wallet_adjustments'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('reason', [...EXISTING_REASONS, 'funding_request'])
        .notNullable()
        .alter()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('reason', EXISTING_REASONS).notNullable().alter()
    })
  }
}
