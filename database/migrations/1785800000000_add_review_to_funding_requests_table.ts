import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Trace de la décision du gestionnaire sur une demande de réapprovisionnement.
 *
 * `verified_amount` est distinct de `declared_amount` : le marchand déclare, le gestionnaire
 * constate.
 */
export default class extends BaseSchema {
  protected tableName = 'funding_requests'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Montant constaté par le gestionnaire, et crédité. `null` tant que la demande n'est pas traitée.
      table.decimal('verified_amount', 15, 2).nullable()

      table.integer('reviewed_by_admin_id').unsigned().nullable().index()
      table.timestamp('reviewed_at').nullable()

      // Motif de la décision, obligatoire en cas de refus.
      table.text('review_comment', 'mediumtext').nullable()

      table.integer('wallet_adjustment_id').unsigned().nullable().index()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('verified_amount')
      table.dropColumn('reviewed_by_admin_id')
      table.dropColumn('reviewed_at')
      table.dropColumn('review_comment')
      table.dropColumn('wallet_adjustment_id')
    })
  }
}
