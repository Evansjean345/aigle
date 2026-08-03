import { BaseSchema } from '@adonisjs/lucid/schema'

/** Énumération des motifs d'ajustement, sans le réapprovisionnement. */
const REASONS_WITHOUT_FUNDING = [
  'missing_debit',
  'duplicate_credit',
  'duplicate_debit',
  'reconciliation_gap',
  'system_error',
  'other',
]

/**
 * Retire les traces du réapprovisionnement dans les ajustements de wallet.
 *
 * Un réapprovisionnement est une entrée d'argent, pas une écriture corrective : il crédite
 * directement le solde et écrit sa propre ligne ledger, comme un dépôt.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('funding_requests', (table) => {
      table.dropColumn('wallet_adjustment_id')
    })

    this.schema.alterTable('wallet_adjustments', (table) => {
      table.enum('reason', REASONS_WITHOUT_FUNDING).notNullable().alter()
    })
  }

  async down() {
    this.schema.alterTable('funding_requests', (table) => {
      table.integer('wallet_adjustment_id').unsigned().nullable().index()
    })

    this.schema.alterTable('wallet_adjustments', (table) => {
      table
        .enum('reason', [...REASONS_WITHOUT_FUNDING, 'funding_request'])
        .notNullable()
        .alter()
    })
  }
}
