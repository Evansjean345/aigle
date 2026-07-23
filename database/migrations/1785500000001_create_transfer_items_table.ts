import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Bénéficiaire d'un lot de paiement en masse = **unité d'exécution** ET **outbox** (L2 : table
 * `transfer_item` = journal de travail durable repris par le relais). `idempotency_key = batchId:
 * sequence` (anti double-paiement). `transaction_reference` = lien vers la transaction core créée
 * par l'engine (la transaction reste la source comptable). Statut en string. Index sur `status` et
 * `next_retry_at` pour la sélection du relais.
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  protected tableName = 'transfer_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('batch_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('transfer_batches')
        .onDelete('CASCADE')
        .index()

      table.string('idempotency_key').notNullable().unique()
      table.integer('sequence').unsigned().notNullable()

      table.decimal('amount', 15, 2).notNullable()
      table.decimal('fees', 15, 2).notNullable().defaultTo(0)
      table.string('currency').notNullable().defaultTo('XOF')

      table.string('recipient_name').nullable()
      table.string('recipient_phone').notNullable()
      table.string('operator').notNullable()
      table.string('country').notNullable().defaultTo('ci')

      table.string('status').notNullable().defaultTo('queued').index()
      table.string('transaction_reference').nullable()
      table.string('provider_reference').nullable()
      table.text('failure_reason').nullable()

      table.integer('attempts').unsigned().notNullable().defaultTo(0)
      table.timestamp('next_retry_at').nullable().index()
      table.timestamp('settled_at').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}