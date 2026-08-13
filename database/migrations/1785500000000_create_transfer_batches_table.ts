import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lot d'un **paiement en masse** (mass-transfer, L2-D1). Account-centric : `account_id` = compte
 * source (org), pas de FK vers identity (money reste indépendant). PK entière (L2-D5) ; `reference`
 * = identifiant métier public (`transfer_xxx`). Statut en **string** (pas d'enum DB), comme
 * `transactions`. `reservation_ref` = id de l'écriture ledger de hold (transaction-less, L2-D4).
 *
 * L'USER exécute la migration (`node ace migration:run`).
 */
export default class extends BaseSchema {
  protected tableName = 'transfer_batches'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('reference').notNullable().unique()
      table.uuid('account_id').notNullable().index()
      table.string('initiated_by').notNullable()
      table.string('approved_by').nullable()
      table.string('label').nullable()
      table.text('description', 'mediumtext').nullable()

      table.decimal('total_amount', 15, 2).notNullable().defaultTo(0)
      table.decimal('fees', 15, 2).notNullable().defaultTo(0)
      table.string('currency').notNullable().defaultTo('XOF')

      table.integer('expected_count').unsigned().notNullable().defaultTo(0)
      table.integer('successful_count').unsigned().notNullable().defaultTo(0)
      table.integer('failed_count').unsigned().notNullable().defaultTo(0)

      table.string('status').notNullable().defaultTo('pending_approval').index()
      table.string('idempotency_key').nullable().unique()
      table.string('reservation_ref').nullable()

      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
