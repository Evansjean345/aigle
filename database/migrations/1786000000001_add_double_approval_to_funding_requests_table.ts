import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Trace de la première approbation, pour les demandes qui exigent deux valideurs.
 *
 * `approval_threshold_applied` fige le seuil en vigueur au moment de la décision : sans lui, la
 * question « pourquoi ce dossier n'a-t-il eu qu'un valideur ? » resterait sans réponse dès que le
 * seuil change.
 */
export default class extends BaseSchema {
  protected tableName = 'funding_requests'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Gestionnaire ayant constaté le montant et demandé le crédit. Nul si un seul valideur a suffi.
      table.integer('first_approved_by_admin_id').unsigned().nullable().index()
      table.timestamp('first_approved_at').nullable()

      table.bigInteger('approval_threshold_applied').unsigned().nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('first_approved_by_admin_id')
      table.dropColumn('first_approved_at')
      table.dropColumn('approval_threshold_applied')
    })
  }
}
